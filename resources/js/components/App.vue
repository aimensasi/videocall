<template>
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-md-8">
        <div class="card">
          <div class="card-header">Video Live Chat</div>

          <div class="card-body">
              <h4 class="status-header" v-if="status">{{ status }}</h4>
              <div class="video-container">
                <div class="call-box d-flex flex-row" v-if="incomingCall">
                  <span class="material-icons icon icon-accept" @click="onIncomingCall">done</span>
                  <span class="material-icons icon icon-reject" @click="onRejectCall">clear</span>
                </div>
                <video class="mine" v-if="currentUserStream" :srcObject.prop="currentUserStream" autoplay></video>
                <video class="theirs" v-if="otherUserStream" :srcObject.prop="otherUserStream" autoplay></video>

                <span class="material-icons icon icon-end" v-if="otherUserStream" @click="onEndCall">call_end</span>
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
        status: null,
        currentUserStream: null, 
        otherUserStream: null, 
        channel: null,
        peers: {},
        user: null,
        users: [],
        incomingCall: false,
        callSignal: {},
        mediaHandler: null,
        isBusy: false,
        currentPeer: null,
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
            this.callSignal = signal;
            this.incomingCall = true;
            return;
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

        this.currentPeer = peer;

        peer.on('signal', (data) => {
          console.log("On Signle...", userId, initiator, data);
          
          this.channel.trigger(`client-signal-${userId}`, {
            type: 'signal',
            userId: this.user.id,
            data: data
          });
        });

        peer.on('data', (data) => {
          console.log("On Data", data);
          this.currentUserStream.getVideoTracks()[0].stop();
          this.currentUserStream = null;
          peer.destroy();
          this.status = 'call Ended';
          this.isBusy = false;
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

          if(this.currentUserStream){
            this.currentUserStream.getVideoTracks()[0].stop();
          }
          
          this.currentUserStream = null;
          this.otherUserStream = null;

          this.peers[userId] = undefined;
        });

        return peer;
      },
      onCall: function(userId){
        if(this.mediaHandler === undefined || this.isBusy){
          throw new Error("Something went wrong");
        }

        this.mediaHandler.getPremission()
        .then((stream) => {
          this.currentUserStream = stream;
          this.peers[userId] = this.setPeer(userId);
          this.isBusy = true;
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
        if(this.callSignal.userId === undefined || this.isBusy){
          throw new Error("Something went wrong");
        }

        this.incomingCall = false;

        this.mediaHandler.getPremission()
        .then((stream) => {
          this.currentUserStream = stream;

          let peer = this.setPeer(this.callSignal.userId, false);
          this.peers[this.callSignal.userId] = peer;
          peer.signal(this.callSignal.data);
          this.isBusy = true;
        }).catch(() => {
          console.log("please allow the app to use your camera and microphone, and refresh");
        });
      },
      onRejectCall: function(){
        let peer = new Peer({
          initiator: false,
          trickle: false,
        });
        console.log("On rejected");
        peer.on('connect', () => {
          console.log("On Connected", peer);
          peer.send('rejected');
          peer.destroy();
          this.incomingCall = false;
        });

        peer.on('signal', (data) => {
          console.log("On Singal");
          this.channel.trigger(`client-signal-${this.callSignal.userId}`, {
            type: 'signal',
            userId: this.user.id,
            data: data
          });
        });

        peer.signal(this.callSignal.data);
      },
      onEndCall: function(){
        this.currentPeer.send('rejected');
        this.currentPeer.destroy();
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
    .icon-end{
      position: absolute;
      bottom: 38px;
      left: 243px;
      color: white;
      background: #f50e0e;
      padding: 1rem;
      border-radius: 21px;
    }
  }
</style>