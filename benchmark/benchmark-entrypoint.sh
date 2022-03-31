#git clone https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore.git
cd adblockpluscore
npm install 
npm run benchmark:save
git checkout origin next
npm install
npm run benchmark:save
npm run benchmark:compare

