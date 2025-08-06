#!/bin/bash

# If OPENAI_API_KEY not set and .env exists, use env-file
if [ -z "$OPENAI_API_KEY" ] && [ -f .env ]; then
    docker run -p 8888:8888 --env-file .env fastapi-app
else
    # Check if we have the key from environment
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "Error: OPENAI_API_KEY not found"
        echo "Please either:"
        echo "  1. Set it as an environment variable: OPENAI_API_KEY=your_key_here ./run.sh"
        echo "  2. Add it to a .env file: OPENAI_API_KEY=your_key_here"
        exit 1
    fi
    
    docker run -p 8888:8888 -e OPENAI_API_KEY=$OPENAI_API_KEY fastapi-app
fi 