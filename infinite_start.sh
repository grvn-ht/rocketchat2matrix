#!/bin/bash

# Command to execute
COMMAND="npm start"

# Delay between retries (in seconds)
RETRY_DELAY=5

# Loop indefinitely
while true; do
    # Execute the command
    echo "Executing command: $COMMAND"
    $COMMAND

    # Check the exit status of the command
    if [ $? -eq 0 ]; then
        # Command succeeded, break out of the loop
        echo "Command succeeded."
        break
    else
        # Command failed, wait before retrying
        echo "Command failed. Retrying in $RETRY_DELAY seconds..."
        sleep $RETRY_DELAY
    fi
done
