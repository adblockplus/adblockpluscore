#git clone https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore.git
cd adblockpluscore
rm -rf benchmark/benchmarkresults.json
npm install 
npm run benchmark:save
git checkout origin master
npm install
npm run benchmark:save
npm run test benchmark/compare-results.js 