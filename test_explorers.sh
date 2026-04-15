#!/bin/bash
# Quick test of explorer URLs via CDP

echo "Testing explorer URLs via CDP..."

# 1. Etherscan - AaveV3Ethereum
ID1=$(curl -s "http://localhost:3456/new?url=https://etherscan.io/address/0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2#readProxyContract#F23" | jq -r '.targetId')
echo "1. AaveV3Ethereum (etherscan.io) - Target: $ID1"
sleep 2
curl -s "http://localhost:3456/info?target=$ID1"

echo -e "\n---\n"

# 2. Arbitrum
ID2=$(curl -s "http://localhost:3456/new?url=https://arbiscan.io/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23" | jq -r '.targetId')
echo "2. AaveV3Arbitrum (arbiscan.io) - Target: $ID2"
sleep 2
curl -s "http://localhost:3456/info?target=$ID2"

echo -e "\n---\n"

# 3. Base
ID3=$(curl -s "http://localhost:3456/new?url=https://basescan.org/address/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5#readProxyContract#F23" | jq -r '.targetId')
echo "3. AaveV3Base (basescan.org) - Target: $ID3"
sleep 2
curl -s "http://localhost:3456/info?target=$ID3"

echo -e "\n---\n"

# 4. Metis
ID4=$(curl -s "http://localhost:3456/new?url=https://metisscan.info/address/0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57#readProxyContract#F23" | jq -r '.targetId')
echo "4. AaveV3Metis (metisscan.info) - Target: $ID4"
sleep 2
curl -s "http://localhost:3456/info?target=$ID4"

echo -e "\n---\n"

# 5. Soneium (Blockscout)
ID5=$(curl -s "http://localhost:3456/new?url=https://soneium.blockscout.com/address/0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B?tab=read_proxy#0xc952485d" | jq -r '.targetId')
echo "5. AaveV3Soneium (blockscout.com) - Target: $ID5"
sleep 2
curl -s "http://localhost:3456/info?target=$ID5"

echo -e "\n---\n"

# 6. Ink (Blockscout)
ID6=$(curl -s "http://localhost:3456/new?url=https://explorer.inkonchain.com/address/0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA?tab=read_proxy#0xc952485d" | jq -r '.targetId')
echo "6. AaveV3Ink (explorer.inkonchain.com) - Target: $ID6"
sleep 2
curl -s "http://localhost:3456/info?target=$ID6"

echo -e "\n---\n"

# 7. XLayer (OKLink)
ID7=$(curl -s "http://localhost:3456/new?url=https://www.oklink.com/xlayer/address/0xE3F3Caefdd7180F884c01E57f65Df979Af84f116" | jq -r '.targetId')
echo "7. AaveV3XLayer (oklink.com) - Target: $ID7"
sleep 2
curl -s "http://localhost:3456/info?target=$ID7"

echo -e "\n=== Summary of page titles ==="
echo "1. Etherscan: $(curl -s "http://localhost:3456/eval?target=$ID1" -X POST -d 'document.title' | jq -r '.result // "N/A"' 2>/dev/null)"
echo "2. Arbitrum: $(curl -s "http://localhost:3456/eval?target=$ID2" -X POST -d 'document.title' | jq -r '.result // "N/A"' 2>/dev/null)"
echo "3. Base: $(curl -s "http://localhost:3456/eval?target=$ID3" -X POST -d 'document.title' | jq -r '.result // "N/A"' 2>/dev/null)"
echo "4. Metis: $(curl -s "http://localhost:3456/eval?target=$ID4" -X POST -d 'document.title' | jq -r '.result // "N/A"' 2>/dev/null)"
echo "5. Soneium: $(curl -s "http://localhost:3456/eval?target=$ID5" -X POST -d 'document.title' | jq -r '.result // "N/A"' 2>/dev/null)"
echo "6. Ink: $(curl -s "http://localhost:3456/eval?target=$ID6" -X POST -d 'document.title' | jq -r '.result // "N/A"' 2>/dev/null)"
echo "7. XLayer: $(curl -s "http://localhost:3456/eval?target=$ID7" -X POST -d 'document.title' | jq -r '.result // "N/A"' 2>/dev/null)"
