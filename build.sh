set -e

REMOTE=`git remote get-url origin`

rm release -rf
mkdir release

cp package.json release
cp dist -r release

cp action/* -r release

ls release -al
cd release

npm install --production
rm package.json
rm package-lock.json

git init
git remote add origin $REMOTE
git checkout -b latest
git add .
git commit -m "Release latest"
git push origin latest -f

cd ../
rm release -rf