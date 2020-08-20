[![Build Status][image]][travis-url]

## Tokyo Schema
> Validate input using [Joi](https://github.com/hapijs/joi)

### Types
Time : Human readable string without time zone considered (UTC). Only support `YYYY/MM/DD HH:mm:ss` format.
- eg) 01/21/2018 09:30:00

Account : 20 Bytes Ethereum account starting with "0x"
- eg) 0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c

Uint : __string__ parsed with `bignumber.js` for unsigned integer.
- eg) "400000000000000000000", "1e18"

### Schema

```
{
  project_name: String,

  // token defines which function should be given
  token : {
    token_type : {
      is_minime : Boolean,
    },
    token_option : {
      burnable : Boolean,          // self-burnable
      pausable : Boolean,          // pause token transfer. MiniMe token is pausable as default.
      no_mint_after_sale: Boolean, // no more token generation after sale
    },
    token_name : String,
    token_symbol : String,
    decimals : Number,
    use_custom_token: Boolean         // use customized token. token contract will
                                      // go by "<ProjectName>CustomToken"
  },
  sale : {
    max_cap : Uint, // decimals considered
    min_cap : Uint, // decimals considered
    start_time : Time,
    end_time : Time,

    // base value to calculate ratio.
    // if coeff is 1000, ratio value is 20, which means 20/1000 (2%)
    coeff: Uint,

    rate: {
      is_static: Boolean, // true if no bonus, false if dynamic rate
      base_rate: Uint,    // rate without bonus.
                          // token amount = ether amount * rate

      bonus: { // only required for dynamic rate with bonus
               // token rate = base rate * (time bonus + amount bonus + coeff) / coeff

        use_time_bonus : Boolean,
        use_amount_bonus : Boolean,

        // give additional bonus for time and ether amount.
        // bonus_time_stage should be sorted in ascending.
        // bonus_amount_stage should be sorted in descending.
        time_bonuses : [
          {
            bonus_time_stage: Time, // end time of time bonus
            bonus_time_ratio: Uint, // bonus rate
          }
        ],
        amount_bonuses : [
          {
            bonus_amount_stage: Uint, // start amount of amount bonus
            bonus_amount_ratio: Uint, // bonus rate
          }
        ]
      }
    },

    // after sale is finished, distribute ether and generate more tokens
    // to designated accounts
    distribution: {
      token : [
        {
          // `token_holder` can only 3 type of string as value.
          //  - "crowdsale": ratio of tokens purchaed by crowdsale contract.
          //     this ratio detemines the _final total supply_.
          //  - "locker": ratio of tokens generated to locker.
          //     then locker release tokens based on release info.
          //  - Account: ethereum address to be given without purchasing.
          token_holder: "crowdsale" | "locker" | Account,

          // all token_holder's sum of token_ratio should be equal to `coeff`
          token_ratio : Uint
        }
      ],

      // distribute Ether locked in vault.
      ether : [
        {
          // `ether_holder` can only 2 type of string as value.
          //  - "multisig<N>": N'th multisig wallet.
          //    multi-signature wallet contracts will be deployed according to
          //    "multisig" section. see examples
          //  - Account: ethereum address to receive Ether
          ether_holder: "multisig" | Account,
          ether_ratio : Number
        }
      ]
    },

    // Define sale stages seperated by times.
    // independent cap / kyc / max & min purchase limits could be set.
    stages: [
      {
        start_time: Time, // start time of stage, inclusive
        end_time: Time,   // end time of stage, inclusive
                          // start time of next stage should be later than end time
                          // of previous stage

        cap_ratio: Uint,  // 0 for no seperated cap for the stage.
                          // refund partial amount of ether
                          // if raised weia amount is over cap

        min_purchase_limit: Uint, // 0 for no limit,
                                  // reject token purchase
                                  // over this amount of ether

        max_purchase_limit: Uint, // 0 for no limit,
                                  // limit purchaser from funding too many ether.
                                  // this doesn't reject TX, but reduce msg.value
                                  // to fit this limit and refund not-funded ether.
        kyc: Boolean, // check kyc for this stage
      }
    ],
    valid_purchase: {
      min_purchase_limit : Uint, // 0 for no limit
                                 // reject token purchase
                                 // under this amount of ether

      max_purchase_limit : Uint, // 0 for no limit
                                 // limit purchaser from funding too many ether.
                                 // this doesn't reject TX, but reduce msg.value
                                 // to fit this limit and refund not-funded ether.

      block_interval : Number    // 0 for no limit
                                 // only accept token purchase
                                 // if last token purchase TX's block number
                                 // is less than current block number - interval
    },
    new_token_owner : Account,   // account to hold ownership of token after
                                 // sale is finalized.
    multisig : {
      use_multisig : Boolean,

      // each info is used as parameters for multisig wallet contract's constructor
      // see detail explanation: https://github.com/Onther-Tech/tokyo-reusable-crowdsale/blob/a7342431f8fc635702de033f9d2b6bac67f274d9/contracts/wallet/MultiSigWallet.sol
      infos: [
        {
          num_required: Number,
          owners: [ Account ]  
        }
      ]
    }
  },

  // Lock tokens and release them periodically (or linearly)
  // see more explanation: https://github.com/Onther-Tech/tokyo-reusable-crowdsale/blob/ac9656cca602465d1f2cf14f99e6edf5c0a98cf8/contracts/locker/Locker.sol#L11
  locker : {
    use_locker : Boolean,
    beneficiaries: [{
      address: Account | Multisig,       // token beneficiaries
      ratio: Uint                        // The ratio designated to this beneficiary
      is_straight : Boolean,             // locking type : straight, variable

      // A single release for simple locker (a single release time & 100% of the token)
      release : [ { relase_time: Time, release_ratio: Uint } ]
    }]
  }
}
```

### Example

```javascript
// ES6
import validate from 'tokyo-schema';

// ES5
const validate = require('tokyo-schema').default;

const inputObj = {...} // Input with the above schema form

const result = validate(inputObj);

if (result.error) {
  console.error(result.error);

  // inputObj is invalid schema
} else {
  const obj = resuilt.value;

  // use `obj`...
}

```




[image]: https://secure.travis-ci.org/Onther-Tech/tokyo-schema.png?branch=master

[travis-url]: https://secure.travis-ci.org/Onther-Tech/tokyo-schema
