  #!/bin/sh -e
  ref='issue-403'
  #This should be switched to core once artifacts will be available on master
  project='a.czyzewska'
  # project='eyeo%2Fadblockplus%2Fabc'
  echo 'https://gitlab.com/api/v4/projects/'$project'%2Fadblockpluscore/pipelines?per_page=200'
  current_pipeline_id=$(curl -sS -H "Content-Type: application/json" \
                              'https://gitlab.com/api/v4/projects/'$project'%2Fadblockpluscore/pipelines?per_page=200' | \
                          jq -r \
                             'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
  #current_pipeline_id=$(curl -sS -H "Content-Type: application/json" \
   #                           'https://gitlab.com/api/v4/projects/a.czyzewska%2Fadblockpluscore/pipelines?per_page=100' | \
   #                      jq -r \
    #                         'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
  current_job_id=$(curl -sS -H "Content-Type: application/json" \
                           'https://gitlab.com/api/v4/projects/'$project'%2Fadblockpluscore/pipelines/'$current_pipeline_id'/jobs' | \
                     jq -r \
                       'map(select(.ref=="'$ref'" and .status=="success")) | first | .id')
#echo 'https://gitlab.com/api/v4/projects/a.czyzewska%2Fadblockpluscore/pipelines/'$current_pipeline_id'/jobs' 
   current_job_id=$(curl -sS -H "Content-Type: application/json" \
                           'https://gitlab.com/api/v4/projects/'$project'%2Fadblockpluscore/pipelines/'$current_pipeline_id'/jobs' | \
                     jq -r \
                        'map(select(.ref=="'$ref'" and .name=="benchmark")) | first | .id')
  fetch_dir=$PWD/benchmark
  test -d $fetch_dir || mkdir $fetch_dir
  echo 'https://gitlab.com/api/v4/projects/a.czyzewska%2Fadblockpluscore/jobs/'$current_job_id'/artifacts'
  curl -sS -L \
       --output $fetch_dir/artifacts.zip \
      'https://gitlab.com/api/v4/projects/a.czyzewska%2Fadblockpluscore/jobs/'$current_job_id'/artifacts'
    # 'https://gitlab.com/api/v4/projects/'$project'/jobs/'$current_job_id'/artifacts'

  unzip $fetch_dir/artifacts.zip
  rm -rf artifacts.zip