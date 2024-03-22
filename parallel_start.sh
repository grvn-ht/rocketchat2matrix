#!/bin/bash

# Define the directory containing the input files
input_dir="inputs/test"

# Initialize a counter for running background processes
running_processes=0

# Declare an associative array to store PID and file path pairs
declare -A pid_files

# Function to delete file and remove it from the associative array
move_file() {
    local pid=$1
    local file=${pid_files[$pid]}
    unset pid_files[$pid]
    mv "$file" "finished/$file"
    echo "File deleted: $(basename "$file")"
}

# Iterate over each file in the input directory
for file in "$input_dir"/*.json; do
    # Launch npm start command with the file path as argument in background
    npm start -- "$file" &

    # Capture the PID of the background process
    pid=$!
    pid_files[$pid]=$file

    # Increment the counter
    ((running_processes++))

    # Check if the maximum number of background processes (5) has been reached
    if [ $running_processes -ge 10 ]; then
        # Wait for one of the background processes to finish
        wait -n

        # Decrement the counter
        ((running_processes--))

        # Get the PID of the finished process
        finished_pid=$!

        # Delete the file associated with the finished process
        move_file "$finished_pid"
    fi
done
