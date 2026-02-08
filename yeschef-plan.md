Here is our plan for our hackathon project:

- We have started a react native + expo frontend on Rork.com
- We started a fastapi backend which we will host on Render

- Supabase for auth and db
- Supadata for social data
- Firecrawl for web data
- Gemini as AI models
- Livekit as realtime library to work with gemini in live cook
  Our aim is this:

- We have a mobile (ios) app where a user can paste a link
- We validate this link
  - if it's a text web link we pass to Firecrawl api
  - if it's a youtube (standard and shorts), instagram, tiktok link we send to supadata metadata and transcript api
  - Our aim from both of these is to validate the data is a recipe, if it isn't a recipe we reject it and let user know, if it is a recipe we get structured data for things we expect from a recipe like ingredients, measurements, steps etc. (more enriched data the better)
  - if a link contains multiple recipes we take these as separate recipe entries to save,
  - user can check the ingredients list for a recipe to see if they have required ingredients and check them off
  - then user can pick which recipe they want to live cook
  - note a recipe can be multiple separate meals or a single meal with multiple items (i.e. steak with potatoes and a salad, these are multiple different things of a single meal) (i'm not sure the best way to approach this in terms of live cook)
- The initial part doesn't require a user account, to hook the user, but if user wants to save the extracted recipes they are prompted to create an account (we use supabase for auth and database)
- Once user wants to live cook a saved recipe they are prompted with a revenuecat paywall
- If paid the live cook session starts.
- The live cook session will be handled by gemini live as the model, using livekit as the library to integrate
- The idea of the live cook session is a continous session between the model and user, mainly via bidirectional audio, with a small card section with the current step.
- User can mute their mic if they want
- User can be prompted by the model to turn on their video stream to 'see' something to visually confirm
- User can turn on video stream unprompted to ask model something with video data
- At the end of a session, the transcript of the session is assessed by gemini to summarise and rate the session, user can also add their own comments.

- Our main initial aim is to make a robust backend and manually test it to make sure it behaves how we want, then we will work on the frontend to plug it altogether.
