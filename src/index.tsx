import * as React from "react";
import * as ReactDOM from "react-dom";
// import * as firebase from "firebase/app"
import { Card, Container } from 'semantic-ui-react'
// import 'semantic-ui-css/semantic.min.css'
import { AudioStore } from "./store"
import { SigList, AudioViz } from "./viz"

// firebase.initializeApp({
//   apiKey: "AIzaSyDy3Caew0ql16PM0x7laFXTcs6jih_-e8o",
//   authDomain: "input-output-26476.firebaseapp.com",
//   projectId: "input-output-26476",
// })


const store = new AudioStore()

ReactDOM.render(
  <Container>
    <Card>
      <AudioViz store={store} />
      <Card.Content>
        <Card.Header>Things!</Card.Header>
        <Card.Description>Herein we will put some things.</Card.Description>
      </Card.Content>
    </Card>
    <SigList store={store} />
  </Container>,
  document.getElementById("app-root"))
