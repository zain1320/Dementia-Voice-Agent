from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import random

import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Example usage of logger
logger.info("Logging is set up.")


app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
load_dotenv(override=True)

# Get API key from environment variable
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REALTIME_SESSION_URL = os.getenv("REALTIME_SESSION_URL")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")

# this is the openai url: https://api.openai.com/v1/realtime/sessions
logger.info(f"REALTIME_SESSION_URL: {REALTIME_SESSION_URL}")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment variables")
if not REALTIME_SESSION_URL:
    raise ValueError("REALTIME_SESSION_URL not found in environment variables")
if not SERPER_API_KEY:
    logger.warning("SERPER_API_KEY not found - web search will not work")

class SessionResponse(BaseModel):
    session_id: str
    token: str

class WeatherResponse(BaseModel):
    temperature: float
    humidity: float
    precipitation: float
    wind_speed: float
    unit_temperature: str = "celsius"
    unit_precipitation: str = "mm"
    unit_wind: str = "km/h"
    forecast_daily: list
    current_time: str
    latitude: float
    longitude: float
    location_name: str
    weather_code: int

class SearchResponse(BaseModel):
    title: str
    snippet: str
    source: str
    image_url: str | None = None
    image_source: str | None = None

class VisionRequest(BaseModel):
    image: str  # Base64 encoded image
    prompt: str = "Describe what you see in this image briefly and clearly"

class VisionResponse(BaseModel):
    description: str
    timestamp: str

class SessionRequest(BaseModel):
    voice: str = "echo"
    instructions: str = None

@app.post("/session")
async def get_session(request: SessionRequest):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                REALTIME_SESSION_URL,
                headers={
                    'Authorization': f'Bearer {OPENAI_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    "model": "gpt-4o-realtime-preview",
                    "voice": request.voice,
                    "instructions": """
You are the Caring Video Assistant. Your role is to combine the Vision Observer's sentences with the user's spoken words to guide and encourage someone living with dementia. Use the following principles:

1. **Acknowledge Both Inputs**  
   - When the user speaks, respond to their words in a warm, understanding tone.  
   - When the Vision Observer reports an action, weave it naturally into your reply.

2. **Structure Your Replies**  
   - **Opening:** Reference what you see or heard ("I see you're…", "I heard you say…").  
   - **Guidance or Question:** Offer the next step or ask if they'd like help ("Would you like to stir next?", "Shall I guide you to the next step?").  
   - **Encouragement:** End with a positive note ("You're doing great.", "That looks wonderful.").

3. **Detect Anomalies in Tea-Making**  
   - **Missing Step:** User skips an expected step (e.g., boiled water but didn't add a tea bag)—gently ask:  
     "Shall I remind you how to add the tea bag?"  
   - **Repetition:** Same step twice (e.g., pouring twice)—offer next-step help:  
     "You poured water twice—ready to steep the tea bag?"  
   - **Long Pause (>10s):**  
     "You've been holding the kettle—would you like a reminder?"  
   - **Out-of-Order Action:** (e.g., stirring before adding anything)—point it out kindly:  
     "You're stirring already—would you like to add milk first?"

4. **Timing & Throttling**  
   - Only speak when the user speaks or a new Vision Observer sentence arrives.  
   - Limit to one assistant reply per observation.  
   - Ignore duplicate observations within 5 seconds.

5. **Dialogue Style**  
   - **Tone:** Warm, calm, encouraging.  
   - **Length:** One or two short sentences (max **12 words** each).  
   - **Pronouns:** Use "you" and "we" ("you're doing well," "let's try the next step").  
   - **Avoid:** Technical terms ("action," "object," "frame").

6. **Friendly Conversation & Praise**  
   - Compliment progress: "That's a lovely mug you've chosen."  
   - Celebrate completion: "Your tea looks perfect!"  
   - Answer any direct user question.

7. **Example Exchanges**  
[Vision] I see you boiled water.
[Assistant] "Great, you've boiled water—shall we add the tea bag now?"

[Vision] I notice you're stirring an empty cup.
[Assistant] "You're stirring already—would you like to add milk first?"

[Vision] I see you poured water twice into the mug.
[Assistant] "You poured water again—ready to steep the tea bag?"

[Vision] I notice you've paused holding the kettle.
[Assistant] "Are you ready to pour water into the cup?"

---

**Always blend gentle observation with tea-specific guidance, ensuring your patient feels supported, understood, and confident throughout their tea-making ritual.**

                    """
                }
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error occurred: {e.response.status_code}")
        return JSONResponse(status_code=e.response.status_code, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Internal Server Error", "details": str(e)})

@app.get("/weather/{location}")
async def get_weather(location: str):
    try:
        async with httpx.AsyncClient() as client:
            # Get coordinates for location
            geocoding_response = await client.get(
                f"https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1"
            )
            geocoding_data = geocoding_response.json()
            
            if not geocoding_data.get("results"):
                return {"error": f"Could not find coordinates for {location}"}
                
            lat = geocoding_data["results"][0]["latitude"]
            lon = geocoding_data["results"][0]["longitude"]
            location_name = geocoding_data["results"][0]["name"]
            
            # Get weather data with more parameters
            weather_response = await client.get(
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code"
                f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code"
                f"&timezone=auto"
                f"&forecast_days=7"
            )
            weather_data = weather_response.json()
            
            # Extract current weather
            current = weather_data["current"]
            daily = weather_data["daily"]
            
            # Create daily forecast array
            forecast = []
            for i in range(len(daily["time"])):
                forecast.append({
                    "date": daily["time"][i],
                    "max_temp": daily["temperature_2m_max"][i],
                    "min_temp": daily["temperature_2m_min"][i],
                    "precipitation": daily["precipitation_sum"][i],
                    "weather_code": daily["weather_code"][i]
                })
            
            return WeatherResponse(
                temperature=current["temperature_2m"],
                humidity=current["relative_humidity_2m"],
                precipitation=current["precipitation"],
                wind_speed=current["wind_speed_10m"],
                forecast_daily=forecast,
                current_time=current["time"],
                latitude=lat,
                longitude=lon,
                location_name=location_name,
                weather_code=current["weather_code"]
            )
            
    except Exception as e:
        logger.error(f"Error getting weather data: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Could not get weather data: {str(e)}"})

@app.get("/search/{query}")
async def search_web(query: str):
    try:
        async with httpx.AsyncClient() as client:
            # Get regular search results
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": SERPER_API_KEY},
                json={"q": query}
            )
            
            data = response.json()
            
            # Get image search results with larger size
            image_response = await client.post(
                "https://google.serper.dev/images",
                headers={"X-API-KEY": SERPER_API_KEY},
                json={
                    "q": query,
                    "gl": "us",
                    "hl": "en",
                    "autocorrect": True
                }
            )
            
            image_data = image_response.json()
            
            if "organic" in data and len(data["organic"]) > 0:
                result = data["organic"][0]  # Get the first result
                image_result = None
                
                # Find first valid image
                if "images" in image_data:
                    for img in image_data["images"]:
                        if img.get("imageUrl") and (
                            img["imageUrl"].endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')) or 
                            'images' in img["imageUrl"].lower()
                        ):
                            image_result = img
                            break
                
                return SearchResponse(
                    title=result.get("title", ""),
                    snippet=result.get("snippet", ""),
                    source=result.get("link", ""),
                    image_url=image_result["imageUrl"] if image_result else None,
                    image_source=image_result["source"] if image_result else None
                )
            else:
                return {"error": "No results found"}
                
    except Exception as e:
        logger.error(f"Error performing search: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Could not perform search: {str(e)}"})

@app.post("/vision")
async def process_vision(request: VisionRequest):
    try:
        import base64
        from datetime import datetime
        
        # Decode base64 image
        image_data = base64.b64decode(request.image)
        
        async with httpx.AsyncClient() as client:
            # Use OpenAI Vision API
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    'Authorization': f'Bearer {OPENAI_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": request.prompt
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{request.image}",
                                        "detail": "low"  # Use low detail for faster processing
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 150  # Keep descriptions concise
                }
            )
            
            response.raise_for_status()
            result = response.json()
            
            description = result["choices"][0]["message"]["content"]
            
            logger.info(f"Vision processed: {description[:100]}...")
            
            return VisionResponse(
                description=description,
                timestamp=datetime.now().isoformat()
            )
            
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            logger.warning(f"Rate limit exceeded for vision API - will retry later")
            return VisionResponse(
                description="Rate limit reached - vision temporarily unavailable",
                timestamp=datetime.now().isoformat()
            )
        else:
            logger.error(f"HTTP error processing vision: {e.response.status_code}")
            return JSONResponse(status_code=500, content={"error": f"Vision API error: {e.response.status_code}"})
    except Exception as e:
        logger.error(f"Error processing vision: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Could not process image: {str(e)}"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888) 