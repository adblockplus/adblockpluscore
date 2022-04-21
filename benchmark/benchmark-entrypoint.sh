#!/bin/bash
#git clone https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore.git
cd adblockpluscore
rm -rf benchmark/benchmarkresults.json
npm install 
#npm run benchmark:save
CURRENTTS=$(date +%FT%TZ)

for script in benchmark:easylist benchmark:easylist+AA benchmark:allFilters benchmark:match:all benchmark:match:all:easylist benchmark:match:all:easylist+AA benchmark:match:all:allFilters
do
  npm run $script -- --save --save-temp --ts=$CURRENTTS
done

#git checkout origin master
#npm install
REFSTS=$(date +%FT%TZ)
for script in benchmark:easylist benchmark:easylist+AA benchmark:allFilters benchmark:match:all benchmark:match:all:easylist benchmark:match:all:easylist+AA benchmark:match:all:allFilters
do
  npm run $script -- --save --save-temp --ts=$REFSTS
done

npm  --current=$CURRENTTS --refs=$REFSTS run test benchmark/compare-results.js

if [[ "$EXTENDHISTORICAL" == true ]]; then
  sh benchmark/fetchAndExtendHistoricalData.sh $REFSTS
fi

