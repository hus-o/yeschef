import os
import json
import asyncio
import base64
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websockets.exceptions import ConnectionClosed
from google import genai
from dependencies import get_gemini_client, get_supabase_client

router = APIRouter()

# WebSocket endpoint for Live Cooking
@router.websocket("/live/{recipe_id}")
async def live_cooking_endpoint(websocket: WebSocket, recipe_id: str):
    await websocket.accept()
    
    supabase = get_supabase_client()
    
    # 1. Fetch Recipe Context
    try:
        res = supabase.table("recipes").select("*").eq("id", recipe_id).execute()
        if not res.data:
            await websocket.close(code=4004, reason="Recipe not found")
            return
        recipe = res.data[0]
    except Exception as e:
        await websocket.close(code=4000, reason=f"Database error: {e}")
        return

    # 2. Initialize Gemini Live Connection
    # We need to replicate the 'client <-> server <-> gemini' proxying.
    # The Google GenAI SDK `aio.live.connect` is the key.
    
    # System Instruction
    system_instruction = f"""
    You are YesChef, an enthusiastic and helpful expert cooking assistant.
    The user is cooking: {recipe['title']}.
    
    Recipe Details:
    Description: {recipe['description']}
    Ingredients: {json.dumps(recipe['ingredients'])}
    Steps: {json.dumps(recipe['steps'])}
    
    Your goal is to guide them step-by-step.
    - Be concise and encouraging.
    - If they ask "What's next?", give them the next step.
    - If they show you video, analyze it to see if they are doing it right.
    - You can use tools if available (like setting a timer), but for now just speak.
    """

    client = get_gemini_client()
    model = "gemini-2.5-flash-native-audio-preview-12-2025"
    config = {"response_modalities": ["AUDIO"]} # We want audio back

    try:
        async with client.aio.live.connect(model=model, config=config) as session:
            # Send initial context
            await session.send(input=system_instruction, end_of_turn=True)

            # Concurrent tasks: 
            # 1. Receive from Client -> Send to Gemini
            # 2. Receive from Gemini -> Send to Client

            async def receive_from_client():
                try:
                    while True:
                        data = await websocket.receive_json()
                        # Expected format: { "realtime_input": { "media_chunks": [...] } } or similar
                        # Or simple { "text": "..." } or { "audio_base64": "..." }
                        
                        # We need to map client events to Gemini events.
                        # Gemini expects `Content` or specific input types.
                        
                        if "audio" in data:
                            # Incoming audio chunk (PCM/Base64)
                            # Verify format required by Gemini (usually PCM 16kHz)
                             await session.send(input={"mime_type": "audio/pcm;rate=16000", "data": base64.b64decode(data['audio'])}, end_of_turn=False)
                        
                        elif "image" in data:
                             await session.send(input={"mime_type": "image/jpeg", "data": base64.b64decode(data['image'])}, end_of_turn=False)
                        
                        elif "text" in data:
                            print(f"Client text: {data['text']}")
                            await session.send(input=data["text"], end_of_turn=True)

                except WebSocketDisconnect:
                    print("Client disconnected")
                except Exception as e:
                    print(f"Error receiving from client: {e}")

            async def receive_from_gemini():
                try:
                    async for response in session.receive():
                        # Response is chunks of audio/text
                        # We need to forward this to the client
                        
                        # The SDK response object structure:
                        # server_content -> model_turn -> parts
                        
                        server_content = response.server_content
                        if server_content is not None:
                             model_turn = server_content.model_turn
                             if model_turn is not None:
                                 for part in model_turn.parts:
                                     if part.inline_data:
                                         # Audio
                                         audio_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                                         await websocket.send_json({"audio": audio_b64})
                                     if part.text:
                                         print(f"Gemini text: {part.text}")
                                         await websocket.send_json({"text": part.text})
                        
                        # Handle tool calls if any... (future)
                        
                except Exception as e:
                    print(f"Error receiving from Gemini: {e}")
                    await websocket.close()

            # Run both
            await asyncio.gather(receive_from_client(), receive_from_gemini())

    except Exception as e:
        print(f"Live session error: {e}")
        import traceback
        with open("server_error.log", "a") as f:
            f.write(f"\n[{model}] Error: {str(e)}\n")
            f.write(traceback.format_exc())
            f.write("-" * 20 + "\n")
        
        await websocket.close(code=1011, reason=str(e))

