import * as React from "react";
import * as ReactDOM from "react-dom";
// import * as firebase from "firebase/app"
import { Container, Grid } from 'semantic-ui-react'
// import 'semantic-ui-css/semantic.min.css'
import { AudioStore } from "./store"
import { AudioControls, EventViz, FreqViz, SampleViz, SigList, SpecDiffViz } from "./viz"

// firebase.initializeApp({
//   apiKey: "AIzaSyDy3Caew0ql16PM0x7laFXTcs6jih_-e8o",
//   authDomain: "input-output-26476.firebaseapp.com",
//   projectId: "input-output-26476",
// })


const store = new AudioStore()
store.start()

ReactDOM.render(
  <Container>
  <h2>Ten Teke</h2>
  <Grid columns={3}>
    <Grid.Row>
      <Grid.Column>
       <FreqViz store={store} />
      </Grid.Column>
      <Grid.Column>
       <EventViz store={store} />
      </Grid.Column>
      <Grid.Column>
       <SpecDiffViz store={store} />
      </Grid.Column>
    </Grid.Row>
    <Grid.Row>
      <Grid.Column>
       <SampleViz store={store} />
      </Grid.Column>
      <Grid.Column>
        <AudioControls store={store} />
      </Grid.Column>
      <Grid.Column>
        <SigList store={store} />
      </Grid.Column>
    </Grid.Row>
  </Grid>
  </Container>,
  document.getElementById("app-root"))
