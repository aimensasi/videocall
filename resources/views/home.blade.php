@extends('layouts.app')

@section('content')
  <div id="app"></div>
  
  @auth
    <script>
      window.user = { id: {{ auth()->user()->id }}, name: "{{ auth()->user()->name }}" };
    </script>
  @endauth
@endsection

