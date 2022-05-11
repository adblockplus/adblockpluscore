# !/bin/bash
# set -e

# Make artifacts folder for CI  
mkdir artifacts

# Switch to master repo to run benchmark
cd master/adblockpluscore
npm install
REFSTS=$(date +%FT%TZ)
for script in benchmark:easylist benchmark:easylist+AA benchmark:allFilters benchmark:match:all benchmark:match:all:easylist benchmark:match:all:easylist+AA benchmark:match:all:allFilters
  do
    npm run $script -- --save --save-temp --ts=$REFSTS
  done  

benchmarkResults="benchmark/benchmark_results.json"
# Copy results to current codebase, and rename them to proper one
if [  -f benchmark/benchmarkresults.json ]
then
  mv benchmark/benchmarkresults.json $benchmarkResults
fi

if [  -f $benchmarkResults ]
then
  mv $benchmarkResults /adblockpluscore/$benchmarkResults
  echo ">>> Switching to current codebase to benchmark it <<<"
  cd ../../adblockpluscore
  npm install   
  CURRENTTS=$(date +%FT%TZ)

  for script in benchmark:easylist benchmark:easylist+AA benchmark:allFilters benchmark:match:all benchmark:match:all:easylist benchmark:match:all:easylist+AA benchmark:match:all:allFilters
    do
      npm run $script -- --save --save-temp --ts=$CURRENTTS
    done
  cp /adblockpluscore/$benchmarkResults /artifacts
  
  if $EXTENDHISTORICAL; then
    # Extend historical data with master run only
    echo "extending historical data"
    sh benchmark/fetchAndExtendHistoricalData.sh $CURRENTTS
    cp /adblockpluscore/benchmark/historicalData/historical_data.json /artifacts
  fi
  
  npm  --current=$CURRENTTS --refs=$REFSTS run test benchmark/compareResults.js
  
else
  raise error "Missing benchmark results from run on master, failing"

fi





