  project_file='eyeo%2adblockplus%2abc%2adblockpluscore'
  ref=$(cat $project_file)
  project=$(basename $project_file)
  current_pipeline_id=$(curl -sS -H "Content-Type: application/json" \
                              'https://gitlab.com/api/v4/projects/'$project'/pipelines' | \
                          jq -r \
                             'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
  current_job_id=$(curl -sS -H "Content-Type: application/json" \
                           'https://gitlab.com/api/v4/projects/'$project'/pipelines/'$current_pipeline_id'/jobs' | \
                     jq -r \
                        'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
  fetch_dir=$input/${project}.fetched
  test -d $fetch_dir || mkdir $fetch_dir
  curl -sS -L \
       --output $fetch_dir/artifacts.zip \
       'https://gitlab.com/api/v4/projects/'$project'/jobs/'$current_job_id'/artifacts'
  # extract without subdirectory names, overwrite all
  7za e -aoa -o$output $fetch_dir/artifacts.zip

 #curl --location --header "PRIVATE-TOKEN: 9koXpg98eAheJpvBs5tK" https://gitlab.com/a.czyzewska/adblockpluscore/-/jobs/artifacts/issue-403/download?job=benchmark