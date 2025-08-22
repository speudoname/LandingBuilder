#!/bin/bash

# Use expect to handle interactive prompts
expect << 'EOF'
spawn npx vercel blob store add landinger-production-pages

# Wait for the question about linking
expect "Would you like to link this blob store to landinger?"
send "y\r"

# Wait for environment selection
expect "Select environments"
send "\r"

expect eof
EOF