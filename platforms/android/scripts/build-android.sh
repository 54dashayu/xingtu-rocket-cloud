#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../android"
# Use an existing compatible JDK without changing the user's global Java setup.
if [ -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
exec ./gradlew assembleDebug --console=plain
