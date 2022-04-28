# !/bin/bash
set -e

cd adblockpluscore
npm install 
CURRENTTS=$(date +%FT%TZ)

for script in benchmark:easylist benchmark:easylist+AA benchmark:allFilters benchmark:match:all benchmark:match:all:easylist benchmark:match:all:easylist+AA benchmark:match:all:allFilters
do
  npm run $script -- --save --save-temp --ts=$CURRENTTS
done

# Checkout master to have reference data
git reset --hard origin/master
npm install
REFSTS=$(date +%FT%TZ)
for script in benchmark:easylist benchmark:easylist+AA benchmark:allFilters benchmark:match:all benchmark:match:all:easylist benchmark:match:all:easylist+AA benchmark:match:all:allFilters
do
  npm run $script -- --save --save-temp --ts=$REFSTS
done

npm  --current=$CURRENTTS --refs=$REFSTS run test benchmark/compareResults.js

if $EXTENDHISTORICAL; then
# Extend historical data with master run only
  sh benchmark/fetchAndExtendHistoricalData.sh $REFSTS
fi

