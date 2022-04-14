  #!/bin/sh -e
  ref='issue-403'
  project='eyeo%2Fadblockplus%2Fabc%2Fadblockpluscore'
  current_pipeline_id=$(curl -sS -H "Content-Type: application/json" \
                              'https://gitlab.com/api/v4/projects/'$project'/pipelines' | \
                          jq -r \
                             'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
  current_job_id=$(curl -sS -H "Content-Type: application/json" \
                           'https://gitlab.com/api/v4/projects/'$project'/pipelines/'$current_pipeline_id'/jobs' | \
                     jq -r \
                        'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
  fetch_dir=$PWD/benchmark.fetched
  test -d $fetch_dir || mkdir $fetch_dir
  curl -sS -L \
       --output $fetch_dir/artifacts.zip \
       'https://gitlab.com/api/v4/projects/'$project'/jobs/'$current_job_id'/artifacts'
  # extract without subdirectory names, overwrite all
  #7za e -aoa -o$output $fetch_dir/artifacts.zip
  unzip $fetch_dir/artifacts.zip