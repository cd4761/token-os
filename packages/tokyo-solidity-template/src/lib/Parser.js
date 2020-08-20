import range from "lodash/range";

import { writeTabs } from "./templateHelper";

// common constructor parameters for MintableBaseCrowdsale & MiniMeBaseCrowdsale
// [ [solidity data type], [path for lodash.get] ]

const makeArrayPath = (len, prefix, postfix = "") => range(len).map(i => `get(data, "${ prefix }.${ i }${ postfix ? `.${ postfix }` : "" }")`);

/**
 * @title Parser
 * @notice Parses user's input to generate inheritance tree for token and crowdsale.
 * The result will be used to generate contract & migration file.
 */
export default class Parser {
  constructor(input) {
    this.input = input;
  }

  /* eslint-disable complexity */
  parse() {
    const { input } = this;

    const f = () => ({
      parentsList: [], // super contract name
      importStatements: [], // path to import suprt contract
    });

    const meta = {};
    meta.use_custom_token = input.token.use_custom_token;

    const token = f(); // for token contract
    const postToken = f(); // appended to toekn

    const crowdsale = f(); // for crowdsale contract
    const postCrowdsale = f(); // appended to crowdsale

    const codes = { // solidity or JS source code
      migration: "",
      crowdsale: {
        init: "",
      },
    };
    const constructors = {}; // for constructors for Crowdsale, Locker

    let crowdsaleConstructorArgumentLength = 0;

    const tab2 = 2;
    const tab3 = 3;

    meta.projectName = input.project_name.replace(/\W/g, "");

    codes.migration += `
${ writeTabs(tab2) }const tokenDistributions = get(data, "input.sale.distribution.token");
${ writeTabs(tab2) }const lockerRatios = tokenDistributions
${ writeTabs(tab3) }.filter(t => t.token_holder === "locker")[0].token_ratio;
${ writeTabs(tab2) }const crowdsaleRatio = tokenDistributions
${ writeTabs(tab3) }.filter(t => t.token_holder === "crowdsale")[0].token_ratio;
  `;

    // BaseCrowdsale.init()
    const initMigVars = [
      "new BigNumber(get(data, \"input.sale.start_time\"))",
      "new BigNumber(get(data, \"input.sale.end_time\"))",
      "new BigNumber(get(data, \"input.sale.rate.base_rate\"))",
      "new BigNumber(get(data, \"input.sale.max_cap\"))",
      "new BigNumber(get(data, \"input.sale.min_cap\"))",
      "new BigNumber(crowdsaleRatio)",
      "get(data, \"address.vault\")",
      "get(data, \"address.locker\")",
      "get(data, \"input.sale.new_token_owner\")",
    ];

    codes.migration += `
${ writeTabs(tab2) }const initArgs = [${ initMigVars.map(expr => `\n${ writeTabs(tab3) }${ expr }`).join() }
${ writeTabs(tab2) }];
${ writeTabs(tab2) }
${ writeTabs(tab2) }await crowdsale.init(initArgs.map(toLeftPaddedBuffer));
`;

    // BaseCrowdsale
    crowdsale.parentsList.push("BaseCrowdsale");
    crowdsale.importStatements.push("import \"./base/crowdsale/BaseCrowdsale.sol\";");
    constructors.BaseCrowdsale = [["uint", "input.sale.coeff"]];

    // input.sale.distribution.ether
    // vault.initHolders
    codes.migration += `
${ writeTabs(tab2) }const etherHolderAddresses = get(data, "input.sale.distribution.ether").map(({ether_holder}) => {
${ writeTabs(tab2) }  if (isValidAddress(ether_holder)) return ether_holder;
${ writeTabs(tab2) }  if (ether_holder.includes("multisig")) {
${ writeTabs(tab2) }    const idx = Number(ether_holder.split("multisig")[1]);
${ writeTabs(tab2) }    if (!isValidAddress(address.multisigs[idx])) throw new Error("Invalid multisig address", address.multisigs[idx]);
${ writeTabs(tab2) }
${ writeTabs(tab2) }    return address.multisigs[idx];
${ writeTabs(tab2) }  }
${ writeTabs(tab2) }});
${ writeTabs(tab2) }const etherHolderRatios = get(data, "input.sale.distribution.ether").map(e => e.ether_ratio);
    `;

    codes.migration += `
${ writeTabs(tab2) }await vault.initHolders(
${ writeTabs(tab3) }etherHolderAddresses,
${ writeTabs(tab3) }etherHolderRatios,
${ writeTabs(tab2) });
    `;

    // input.sale.distribution.token
    // crowdsale.initHolders
    codes.migration += `
${ writeTabs(tab2) }const tokenHolderAddresses = get(data, "input.sale.distribution.token").map(({token_holder}) => {
${ writeTabs(tab2) }  if (isValidAddress(token_holder)) return token_holder;
${ writeTabs(tab2) }  if (token_holder === "crowdsale") return "0x00";
${ writeTabs(tab2) }  if (token_holder === "locker") return address.locker;
${ writeTabs(tab2) }  if (token_holder.includes("multisig")) {
${ writeTabs(tab2) }    const idx = Number(token_holder.split("multisig")[1]);
${ writeTabs(tab2) }    if (!isValidAddress(address.multisigs[idx])) throw new Error("Invalid multisig address", address.multisigs[idx]);
${ writeTabs(tab2) }
${ writeTabs(tab2) }    return address.multisigs[idx];
${ writeTabs(tab2) }  }
${ writeTabs(tab2) }});
${ writeTabs(tab2) }const tokenHolderRatios = get(data, "input.sale.distribution.token").map(e => e.token_ratio);
    `;

    codes.migration += `
${ writeTabs(tab2) }await crowdsale.initHolders(
${ writeTabs(tab3) }tokenHolderAddresses,
${ writeTabs(tab3) }tokenHolderRatios,
${ writeTabs(tab2) });
    `;

    // parse input.token
    if (input.token.token_type.is_minime) {
      token.parentsList.push("MiniMeToken");
      token.importStatements.push("import \"minimetoken/contracts/MiniMeToken.sol\";");

      if (input.token.token_option.burnable) {
        token.parentsList.push("BurnableMiniMeToken");
        token.importStatements.push("import \"./base/token/BurnableMiniMeToken.sol\";");
      }

      if (input.token.token_option.pausable) {
        // do nothing. MiniMe is pausable as default
      }

      if (input.token.token_option.no_mint_after_sale) {
        token.parentsList.push("NoMintMiniMeToken");
        token.importStatements.push("import \"./base/token/NoMintMiniMeToken.sol\";");

        postCrowdsale.parentsList.push("FinishMintingCrowdsale");
        postCrowdsale.importStatements.push("import \"./base/crowdsale/FinishMintingCrowdsale.sol\";");

        constructors.FinishMintingCrowdsale = [];
      }

      crowdsale.parentsList.push("MiniMeBaseCrowdsale");
      crowdsale.importStatements.push("import \"./base/crowdsale/MiniMeBaseCrowdsale.sol\";");

      constructors.MiniMeBaseCrowdsale = [["address", "address.token"]];
    } else {
      token.parentsList.push("CanReclaimToken");
      token.importStatements.push("import \"openzeppelin-solidity/contracts/ownership/CanReclaimToken.sol\";");

      token.parentsList.push("MintableToken");
      token.importStatements.push("import \"openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol\";");

      crowdsale.parentsList.push("MintableBaseCrowdsale");
      crowdsale.importStatements.push("import \"./base/crowdsale/MintableBaseCrowdsale.sol\";");

      constructors.MintableBaseCrowdsale = [["address", "address.token"]];

      if (input.token.token_option.burnable) {
        token.parentsList.push("BurnableToken");
        token.importStatements.push("import \"openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol\";");
      }

      if (input.token.token_option.pausable) {
        token.parentsList.push("PausableToken");
        token.importStatements.push("import \"openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol\";");
      }

      if (input.token.token_option.no_mint_after_sale) {
        postCrowdsale.parentsList.push("FinishMintingCrowdsale");
        postCrowdsale.importStatements.push("import \"./base/crowdsale/FinishMintingCrowdsale.sol\";");

        constructors.FinishMintingCrowdsale = [];
      }
    }

    // parse input.sale

    // 1. BonusCrowdsale
    if (!input.sale.rate.is_static) {
      crowdsale.parentsList.push("BonusCrowdsale");
      crowdsale.importStatements.push("import \"./base/crowdsale/BonusCrowdsale.sol\";");

      constructors.BonusCrowdsale = [];

      const numTimeBonuses = input.sale.rate.bonus.use_time_bonus ?
        input.sale.rate.bonus.time_bonuses.length : 0;

      const bonusTimeStages = makeArrayPath(numTimeBonuses, "input.sale.rate.bonus.time_bonuses", "bonus_time_stage");
      const bonusTimeRatios = makeArrayPath(numTimeBonuses, "input.sale.rate.bonus.time_bonuses", "bonus_time_ratio");

      const numAmountBonuses = input.sale.rate.bonus.use_amount_bonus ?
        input.sale.rate.bonus.amount_bonuses.length : 0;

      const bonusAmountStages = makeArrayPath(numAmountBonuses, "input.sale.rate.bonus.amount_bonuses", "bonus_amount_stage");
      const bonusAmountRatios = makeArrayPath(numAmountBonuses, "input.sale.rate.bonus.amount_bonuses", "bonus_amount_ratio");

      codes.migration += `
${ writeTabs(tab2) }const bonusTimeStages = [
${ writeTabs(tab3) }${ bonusTimeStages.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const bonusTimeRatios = [
${ writeTabs(tab3) }${ bonusTimeRatios.join(`,\n${ writeTabs(tab3) }`) } ];
      `;

      codes.migration += `
${ writeTabs(tab2) }const bonusAmountStages = [
${ writeTabs(tab3) }${ bonusAmountStages.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const bonusAmountRatios = [
${ writeTabs(tab3) }${ bonusAmountRatios.join(`,\n${ writeTabs(tab3) }`) } ];
`;

      codes.migration += `
${ writeTabs(tab2) }await crowdsale.setBonusesForTimes(
${ writeTabs(tab3) }bonusTimeStages,
${ writeTabs(tab3) }bonusTimeRatios,
${ writeTabs(tab2) });
`;

      codes.migration += `
${ writeTabs(tab2) }await crowdsale.setBonusesForAmounts(
${ writeTabs(tab3) }bonusAmountStages,
${ writeTabs(tab3) }bonusAmountRatios,
${ writeTabs(tab2) });
`;
    }

    // 2. PurchaseLimitedCrowdsale
    if (input.sale.valid_purchase.max_purchase_limit.gt(0)) {
      crowdsale.parentsList.push("PurchaseLimitedCrowdsale");
      crowdsale.importStatements.push("import \"./base/crowdsale/PurchaseLimitedCrowdsale.sol\";");

      constructors.PurchaseLimitedCrowdsale = [["uint", "input.sale.valid_purchase.max_purchase_limit", input.sale.valid_purchase.max_purchase_limit]];
    }

    // 3. MinimumPaymentCrowdsale
    if (input.sale.valid_purchase.min_purchase_limit.gt(0)) {
      crowdsale.parentsList.push("MinimumPaymentCrowdsale");
      crowdsale.importStatements.push("import \"./base/crowdsale/MinimumPaymentCrowdsale.sol\";");

      constructors.MinimumPaymentCrowdsale = [["uint", "input.sale.valid_purchase.min_purchase_limit", input.sale.valid_purchase.min_purchase_limit]];
    }

    // 4. BlockIntervalCrowdsale
    if (input.sale.valid_purchase.block_interval > 0) {
      crowdsale.parentsList.push("BlockIntervalCrowdsale");
      crowdsale.importStatements.push("import \"./base/crowdsale/BlockIntervalCrowdsale.sol\";");

      constructors.BlockIntervalCrowdsale = [["uint", "input.sale.valid_purchase.block_interval", input.sale.valid_purchase.block_interval]];
    }

    // 5. KYCCrowdsale & StagedCrowdsale
    if (input.sale.stages.length > 0) {
      if (input.sale.stages.findIndex(s => s.kyc === true) >= 0) {
        crowdsale.parentsList.push("KYCCrowdsale");
        crowdsale.importStatements.push("import \"./base/crowdsale/KYCCrowdsale.sol\";");

        constructors.KYCCrowdsale = [["address", "address.kyc"]];
      }

      crowdsale.parentsList.push("StagedCrowdsale");
      crowdsale.importStatements.push("import \"./base/crowdsale/StagedCrowdsale.sol\";");

      constructors.StagedCrowdsale = [["uint", "input.sale.stages.length", input.sale.stages.length]]; // *_length => *.length

      // StagedCrowdsale.initStages
      const numStages = input.sale.stages.length;

      const periodStartTimes = makeArrayPath(numStages, "input.sale.stages", "start_time");
      const periodEndTimes = makeArrayPath(numStages, "input.sale.stages", "end_time");
      const periodCapRatios = makeArrayPath(numStages, "input.sale.stages", "cap_ratio");
      const periodMaxPurchaseLimits = makeArrayPath(numStages, "input.sale.stages", "max_purchase_limit");
      const periodMinPurchaseLimits = makeArrayPath(numStages, "input.sale.stages", "min_purchase_limit");
      const periodKycs = makeArrayPath(numStages, "input.sale.stages", "kyc");

      codes.migration += `
${ writeTabs(tab2) }const periodStartTimes = [
${ writeTabs(tab3) }${ periodStartTimes.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const periodEndTimes = [
${ writeTabs(tab3) }${ periodEndTimes.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const periodCapRatios = [
${ writeTabs(tab3) }${ periodCapRatios.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const periodMaxPurchaseLimits = [
${ writeTabs(tab3) }${ periodMaxPurchaseLimits.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const periodMinPurchaseLimits = [
${ writeTabs(tab3) }${ periodMinPurchaseLimits.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const periodKycs = [
${ writeTabs(tab3) }${ periodKycs.join(`,\n${ writeTabs(tab3) }`) } ];
`;

      codes.migration += `
${ writeTabs(tab2) }await crowdsale.initStages(
${ writeTabs(tab3) }periodStartTimes,
${ writeTabs(tab3) }periodEndTimes,
${ writeTabs(tab3) }periodCapRatios,
${ writeTabs(tab3) }periodMaxPurchaseLimits,
${ writeTabs(tab3) }periodMinPurchaseLimits,
${ writeTabs(tab3) }periodKycs,
${ writeTabs(tab2) });
`;
    }

    // Locker.lock()
    let i = 0; // beneficiary index
    for (const beneficiary of input.locker.beneficiaries) {
      const numReleases = beneficiary.release.length;

      const releaseTimes = makeArrayPath(numReleases, `input.locker.beneficiaries.${ i }.release`, "release_time");
      const releaseRatios = makeArrayPath(numReleases, `input.locker.beneficiaries.${ i }.release`, "release_ratio");

      codes.migration += `
${ writeTabs(tab2) }const release${ i }Times = [
${ writeTabs(tab3) }${ releaseTimes.join(`,\n${ writeTabs(tab3) }`) } ];
${ writeTabs(tab2) }const release${ i }Ratios = [
${ writeTabs(tab3) }${ releaseRatios.join(`,\n${ writeTabs(tab3) }`) } ];
`;

      codes.migration += `
${ writeTabs(tab2) }await locker.lock(
${ writeTabs(tab3) }get(data, "input.locker.beneficiaries.${ i }.address"),
${ writeTabs(tab3) }get(data, "input.locker.beneficiaries.${ i }.is_straight"),
${ writeTabs(tab3) }release${ i }Times,
${ writeTabs(tab3) }release${ i }Ratios,
${ writeTabs(tab2) });
`;
      i += 1;
    }

    // BaseCrowdsale.init()
    const intVars = ["_startTime", "_endTime", "_rate", "_cap", "_goal", "_crowdsaleRatio"];
    const addrVars = ["_vault", "_locker", "_nextTokenOwner"];

    i = 0;
    for (const varName of intVars) {
      codes.crowdsale.init += `${ writeTabs(tab2) }uint ${ varName } = uint(args[${ i++ }]);\n`;
    }

    for (const varName of addrVars) {
      codes.crowdsale.init += `${ writeTabs(tab2) }address ${ varName } = address(args[${ i++ }]);\n`;
    }

    codes.crowdsale.init += `
${ writeTabs(tab2) }require(_endTime > _startTime);
${ writeTabs(tab2) }require(_rate > 0);
${ writeTabs(tab2) }require(_cap > 0);
${ writeTabs(tab2) }require(_goal > 0);
${ writeTabs(tab2) }require(_cap > _goal);
${ writeTabs(tab2) }require(_crowdsaleRatio > 0);
${ writeTabs(tab2) }require(_vault != address(0));
${ writeTabs(tab2) }require(_locker != address(0));
${ writeTabs(tab2) }require(_nextTokenOwner != address(0));
${ writeTabs(tab2) }
${ writeTabs(tab2) }startTime = _startTime;
${ writeTabs(tab2) }endTime = _endTime;
${ writeTabs(tab2) }rate = _rate;
${ writeTabs(tab2) }cap = _cap;
${ writeTabs(tab2) }goal = _goal;
${ writeTabs(tab2) }crowdsaleRatio = _crowdsaleRatio;
${ writeTabs(tab2) }vault = MultiHolderVault(_vault);
${ writeTabs(tab2) }locker = Locker(_locker);
${ writeTabs(tab2) }nextTokenOwner = _nextTokenOwner;
`;

    // append post contract declaration
    token.parentsList = [...token.parentsList, ...postToken.parentsList];
    token.importStatements = [...token.importStatements, ...postToken.importStatements];

    crowdsale.parentsList = [...crowdsale.parentsList, ...postCrowdsale.parentsList];
    crowdsale.importStatements = [...crowdsale.importStatements, ...postCrowdsale.importStatements];

    // constructor for The Crowdsale
    constructors.Crowdsale = [];
    crowdsale.parentsList.forEach((parent) => {
      crowdsaleConstructorArgumentLength += constructors[ parent ].length;

      constructors.Crowdsale = [...constructors.Crowdsale, ...constructors[ parent ]];
    });

    return {
      meta,
      token,
      crowdsale,
      codes,
      constructors,
      initMigVars,
      crowdsaleConstructorArgumentLength,
    };
  }
  /* eslint-enable complexity */
}
