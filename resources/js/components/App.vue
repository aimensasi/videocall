<template>
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-md-8">
        <div class="card">
          <div class="card-header">Video Live Chat</div>

          <div class="card-body">
              <div class="video-container">
                <div class="call-box d-flex flex-row" v-if="incomingCall">
                  <span class="material-icons icon icon-accept" @click="onIncomingCall">done</span>
                  <span class="material-icons icon icon-reject">clear</span>
                </div>
                <video class="mine" v-if="currentUserStream" :srcObject.prop="currentUserStream" autoplay></video>
                <video class="theirs" v-if="otherUserStream" :srcObject.prop="otherUserStream" autoplay></video>
              </div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card">
          <div class="card-header">Contact List</div>

          <div class="card-body">
            <div class="list-group">
              <button type="button" class="list-group-item list-group-item-action"
                v-for="user in users" :key="user.id" @click="onCall(user.id)">
                {{  user.name  }} - {{ user.id }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
  import MediaHandler from "./../MediaHandler";
  import Pusher from 'pusher-js';
  import Peer from 'simple-peer';

  export default {
    data: function(){
      return {
        currentUserStream: null, 
        otherUserStream: null, 
        channel: null,
        peers: {},
        user: null,
        users: [],
        allowed: false,
        incomingCall: false,
        callHolder: {},
        mediaHandler: null,
      }
    },
    mounted() {
      this.user = user;
      this.mediaHandler = new MediaHandler();
      this.fetchUsers();
      this.setup();
    },
    methods: {
      setup: function(){
        // Pusher.logToConsole = true;
        let pusher = new Pusher(process.env.MIX_PUSHER_APP_KEY, {
          authEndpoint: '/pusher/auth',
          cluster: 'ap1',
          auth: {
            params: this.user.id,
            headers: {
              'X-CSRF-TOKEN': token.content
            }
          }
        });

        this.channel = pusher.subscribe('presence-video-channel');
        
        this.channel.bind(`client-signal-${this.user.id}`, (signal) => {
          let peer = this.peers[signal.userId];
          console.log("Peer...", peer, signal);

          if(peer === undefined){
            peer = this.setPeer(signal.userId, false);
          }

          // console.log("Sub", signal);
          peer.signal(signal.data);
        });
      },
      setPeer: function(userId, initiator = true){
        let peer = new Peer({
          initiator,
          stream: this.currentUserStream,
          trickle: false,
        });

        peer.on('signal', (data) => {
          console.log("On Signle...", userId, initiator, data);
          // someone is trying to call us
          if(!initiator){
            if(this.incomingCall == true){
              // console.log("Already in call");
              return;
            }
            this.callHolder = { data, userId };
            this.incomingCall = true;
            return;
          }
          
          this.channel.trigger(`client-signal-${userId}`, {
            type: 'signal',
            userId: this.user.id,
            data: data
          });
        });


        peer.on('connect', () => {
          console.log("On Connnect...", userId, initiator);
        });

        peer.on('stream', (stream) => {
          console.log("On Stream...", userId, initiator);
          this.otherUserStream = stream;
        });

        peer.on('close', () => {
          console.log("On Close...", userId, initiator);
          let peer = this.peers[userId];
          if(peer !== undefined) {
              peer.destroy();
          }

          this.peers[userId] = undefined;
        });

        return peer;
      },
      onCall: function(userId){
        if(this.mediaHandler === undefined){
          throw new Error("Something went wrong");
        }

        this.mediaHandler.getPremission()
        .then((stream) => {
          this.currentUserStream = stream;
          this.peers[userId] = this.setPeer(userId);
        }).catch(() => {
          console.log("please allow the app to use your camera and microphone, and refresh");
        });

      },
      fetchUsers: function(){
        axios.get('/users').then(({ data }) => {
          this.users = data;
        });
      },
      onIncomingCall: function(){
        if(this.callHolder.userId === undefined){
          throw new Error("Something went wrong");
        }

        this.incomingCall = false;

        this.mediaHandler.getPremission()
        .then((stream) => {
          this.currentUserStream = stream;
        }).catch(() => {
          console.log("please allow the app to use your camera and microphone, and refresh");
        });

        this.channel.trigger(`client-signal-${this.callHolder.userId}`, {
          type: 'signal',
          userId: this.user.id,
          data: this.callHolder.data
        });
        
      }
    }
  }
</script>

<style lang="scss" scoped>
  .video-container{
    height: 350px;
    width: 100%;
    .mine{
      height: 110px;
      position: absolute;
      bottom: 10px;
      right: 10px;
      border: 4px solid #eee;
      border-radius: 10px;
    }
    .theirs{
      width: 100%;
      height: 100%;
    }
    .call-box{
      width: 100%;
      height: 100%;
      background: #d9d4dc;
      .icon{
          margin-top: auto;
          color: white;
          font-size: 36px;
          border-radius: 30px;
          padding: 0.6rem;
          margin-top: auto;
          margin-bottom: 1rem;
        &.icon-accept{          
          background: green;
          margin-left: auto;
          margin-right: 0.5rem;
        }
        &.icon-reject{
          background: #f50e0e;
          margin-right: auto;
          margin-left: 0.5rem;
        }
      }
    }
  }
</style>