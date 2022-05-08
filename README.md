# NewO voting escrow vault system
The following contracts implements a veToken for the NewOrder DAO (NWO).
They were created to replace the old staking rewards contract, currently
being used by the DAO to distribute rewards to their token holders.
<br><br>
The main goal is to create a veToken which works as a hub for
the reward distribution tokens system. This contract (veVault)
allows users to lock their ERC20 for a period of time. They receive
veTokens for doing so, which are not transferable.
<br><br>
Afterwards, they can notify the Rewards contracts which will
start paying rewards for them. Also, we implemented the LPReward
contract, which allows for another type of rewards for liquidity
providers. In this contract, the user locks their LP tokens and
if they are veToken holders and the amount of tokens being
provided is at least the same as the ones locked, a boost of rewards
is granted. The boost is the same applied in the veVault.
<br><br>
This vault system was loosely inspired by the old StakingReward contract
by [synthetix](https://github.com/Synthetixio/synthetix) and by other
veTokens implementations like from Curve. 

# Instructions to run
First install npm dependecies
`npm install`

Create a .env file
```shell
echo "ETH_MAINFORK=<INSERT URL PROVIDER WITH YOUR KEYS>" >> .env
```

Install npm dependecies
```shell
npm install
```
<br>
Compile the contracts 
```shell
npx hardhat compile
```
<br>
Run a hardhat node
```shell
npx hardhat node
```
<br>
Deploy the contracts
```shell
npx hardhat run --network localhost scripts/deploy.ts
```
<br>

# Deploy to eth-mainnet
Set .env file
```shell
echo "ETHEREUM_URL=<CHANGE TO YOUR PROVIDER WITH KEY>" >> .env
echo "PRIVATE_KEY=<CHANGE TO DEPLOYER PRIVATE KEY>" >> .env
```
<br>
Change the settings in scripts/ethDeploy.ts
<br>
Install npm dependecies
```shell
npm install
```
<br>
## Run the script
```shell
npx hardhat run --network ethereum scripts/ethDeploy.ts
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```