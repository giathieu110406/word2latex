#!/bin/bash
for i in {1..5}; do
  sed -i '$ d' src/App.tsx
done

for i in {1..10}; do
  echo "      </div>" >> src/App.tsx
  echo "  );" >> src/App.tsx
  echo "}" >> src/App.tsx
  npx tsc --noEmit
  if [ $? -eq 0 ]; then
    echo "Success with $i divs!"
    break
  fi
  # remove the last 3 lines to try again
  sed -i '$ d' src/App.tsx
  sed -i '$ d' src/App.tsx
  sed -i '$ d' src/App.tsx
done
