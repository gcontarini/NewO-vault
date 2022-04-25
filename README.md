# NewO vault system
New vault system with veTokens and multiple rewards distribuition tokens.

# Instructions to run
First install npm dependecies <br>
`npm install`

Now compile the contracts 
`npx hardhat compile` <br>

Run a hardhat node
`npx hardhat node` <br>

Deploy the contracts
`npx hardhat run --network localhost scripts/deploy.ts` <br>

# Developers
## Branch strategy
Development branch is the wip. Don't push to main/master.


# MainNet scripts

## Run a mainNet fork at your localhost
`npx hardhat node --fork https://mainnet.infura.io/v3/26556cff548e498db5d4d07c6f5fa0f6`

## Run the script
`npx hardhat run scripts/ethDeploy.ts --network localhost`

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

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).
