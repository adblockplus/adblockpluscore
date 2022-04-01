#git clone https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore.git
cd adblockpluscore
rm -rf benchmark/benchmarkresults.json
npm install 
npm run benchmark:save
git checkout origin next
npm install
npm run benchmark:save
node benchmark/compare-results.js 
