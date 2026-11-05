#!/bin/zsh
set -euo pipefail
cd "${0:A:h}/.."
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
xcodebuild -project Xingtu.xcodeproj -scheme Xingtu -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath output/DerivedData CODE_SIGNING_ALLOWED=NO build
