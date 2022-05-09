# !/bin/sh -e

set -e

apt-get install jq curl -y
echo "starting"
ref='master'
project='eyeo%2Fadblockplus%2Fabc'
historicalDataFolder='benchmark/historicalData'
historicalDataPath=''$historicalDataFolder'/historical_data.json'
echo $(ls -la)
# Fetching Historical Data
current_pipeline_id=$(curl -sS -H "Content-Type: application/json" \
                              'https://gitlab.com/api/v4/projects/'$project'%2Fadblockpluscore/pipelines?per_page=200' | \
                          jq -r \
                             'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
current_job_id=$(curl -sS -H "Content-Type: application/json" \
                           'https://gitlab.com/api/v4/projects/'$project'%2Fadblockpluscore/pipelines/'$current_pipeline_id'/jobs' | \
                     jq -r \
                        'map(select(.ref=="'$ref'" and .name=="benchmark")) | first | .id')
fetch_dir=$PWD/benchmark
test -d $fetch_dir || mkdir $fetch_dir
curl -sS -L \
       --output $fetch_dir/artifacts.zip \
      'https://gitlab.com/api/v4/projects/'$project'%2Fadblockpluscore/jobs/'$current_job_id'/artifacts'

# Creating temporary folder for artifacts to not override current one
test -d $historicalDataFolder || mkdir $historicalDataFolder
unzip artifacts.zip -d $historicalDataFolder
rm -rf ./artifacts.zip

# If file is not available - create one
if [ ! -f $historicalDataPath ]; then
    echo "Historical data doesn't exists, creating empty one."
    touch $historicalDataPath
    jq -n '{}' > $historicalDataPath
fi

# Extracting current benchmark data and adding to historical data
echo 'Data for timestamp '$1' will be added to historical Data'
node benchmark/extendHistoricalData.js --ts=$1
