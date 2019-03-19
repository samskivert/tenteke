import * as React from "react";
import * as ReactDOM from "react-dom";
// import * as firebase from "firebase/app"
import { Card } from 'semantic-ui-react'
// import 'semantic-ui-css/semantic.min.css'

import * as V from "./viz"
// import * as A from "./app"
// import * as UI from "./ui"

// firebase.initializeApp({
//   apiKey: "AIzaSyDy3Caew0ql16PM0x7laFXTcs6jih_-e8o",
//   authDomain: "input-output-26476.firebaseapp.com",
//   projectId: "input-output-26476",
// })

// const appStore = new S.AppStore()
ReactDOM.render(
  <Card>
    <V.AudioViz />
    <Card.Content>
      <Card.Header>Things!</Card.Header>
      <Card.Description>Herein we will put some things.</Card.Description>
    </Card.Content>
  </Card>,
  document.getElementById("app-root"))
