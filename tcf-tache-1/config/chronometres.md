Indications for claude ai to generate the livekit agent and the livekit web client for un TCF french test training 
Tache 1:
presentation of the TCF tache 1, ask the user to present
wait for the user to start talking
send event startTalkTimer(2 min), then continue with the conversation
timer finish: tell the ai model to stop the test when possible and give a note /20
then to present the strong points and weak points and how to improve.

Tache 2:
presentation of the subject, send event startMutTimer(2 min)
wait for the user to start talking
send event startTalkTimer(3m 30s), continue with the presentation
when timer finish: tell the ai model to stop the test when possible and give a note /20
then to present the strong points and weak points and how to improve.

Tache 3:
presentation of the subject
wait for the user to start talking
send event startTalkTimer(4m 30s), do not talk, let the user talk alone in the 4m 30s
when timer finish: tell the ai model to stop the test when possible and give a note /20
then to present the strong points and weak points and how to improve.

