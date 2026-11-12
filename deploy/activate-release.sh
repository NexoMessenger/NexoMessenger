#!/usr/bin/env bash
# Activate a fully extracted release without touching persistent data or dependencies.
set -eu
DIR=${1:?deployment directory required}
STAGE=${2:?staging directory required}
case "$STAGE" in "$DIR"/.release-stage-[0-9]*-[0-9]*) ;; *) echo 'Invalid staging directory' >&2; exit 1;; esac
[ -d "$DIR" ] && [ -d "$STAGE" ] && [ ! -L "$STAGE" ]
[ -s "$STAGE/dist/index.html" ] && [ -s "$STAGE/server/index.mjs" ] || { echo 'Incomplete release; keeping current site' >&2; exit 1; }
[ -d "$DIR/dist" ] && [ -d "$DIR/server" ] || { echo 'Current release missing; refusing to replace it' >&2; exit 1; }
[ ! -e "$STAGE/old-dist" ] && [ ! -e "$STAGE/old-server" ] || { echo 'Unexpected backup already present' >&2; exit 1; }
# Keep recently generated JS/CSS chunks for open tabs, without retaining
# large media files or accumulating builds indefinitely. Never touch DATA_DIR.
if [ -d "$DIR/dist/assets" ] && [ -d "$STAGE/dist/assets" ]; then
  find "$DIR/dist/assets" -maxdepth 1 -type f -mtime -2 \( -name '*.js' -o -name '*.css' \) -exec cp -pn -t "$STAGE/dist/assets" -- {} +
fi
moved_dist=0; moved_server=0; installed_dist=0; installed_server=0
rollback() {
  code=$?
  if [ "$code" -ne 0 ]; then
    echo 'Activation failed; restoring previous release' >&2
    if [ "$installed_server" -eq 1 ]; then mv "$DIR/server" "$STAGE/new-server" || true; fi
    if [ "$moved_server" -eq 1 ]; then mv "$STAGE/old-server" "$DIR/server" || true; fi
    if [ "$installed_dist" -eq 1 ]; then mv "$DIR/dist" "$STAGE/new-dist" || true; fi
    if [ "$moved_dist" -eq 1 ]; then mv "$STAGE/old-dist" "$DIR/dist" || true; fi
  fi
}
trap rollback EXIT
mv "$DIR/dist" "$STAGE/old-dist"; moved_dist=1
mv "$STAGE/dist" "$DIR/dist"; installed_dist=1
mv "$DIR/server" "$STAGE/old-server"; moved_server=1
mv "$STAGE/server" "$DIR/server"; installed_server=1
trap - EXIT
# Old code and build are generated artifacts, not account data.
rm -rf -- "$STAGE/old-dist" "$STAGE/old-server"
rmdir "$STAGE"
