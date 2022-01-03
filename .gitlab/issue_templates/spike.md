<!--- Provide a general summary of the spike in the Title above -->

## Context
<!-- If there is no parent issue that introduces with the context of why the particular spike is being created, -->
<!-- that context should be provided in the description body of the spike itself.-->
<!-- Example: -->
<!-- The ad blocking core is demonstrating slow performance on Mobile platforms -->
<!-- therefore we are running experiments on how to improve it's performance. -->

## Targeting problem
<!-- Description of the problem which is being solved -->
<!-- e.g. The memory consumption on the mobile devices is too high (above 100MB) -->

## Question we are trying to answer
<!-- What are the questions we are addressing with this spike? -->
<!-- e.g. Does changing the way we are storing filters in the memore can improve memory consumption? -->

## What theory/solution are we trying to test?
<!-- List one or more theories that should be addressed in this spike -->
<!-- e.g. Using Flatbuffers for filter list serialization should reduce memory consumption -->
<!-- since they are not being loaded directly into memory and can be accessed directly -->
<!-- from the harddrive -->

## Success/failure criteria
<!-- List the criteria which help to determine if the spike was successful -->
<!-- and the solution should be brought to the next stage (either implementation -->
<!-- or next rounds of spikes) or disregarded -->
<!-- e.g. memory consumption was reduced to 10MB and adding new filters doesn't have any influence on it -->
