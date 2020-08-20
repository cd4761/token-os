import BigNumber from "bignumber.js";
import cloneDeep from "lodash/cloneDeep";

import validate from "../src/index";

const should = require("chai")
  .use(require("chai-as-promised"))
  .use(require("chai-bignumber")(BigNumber))
  .should();

const sampleData1 = require("tokyo-test-data/sample1.json");

const sampleData2 = cloneDeep(sampleData1);
const sampleData3 = cloneDeep(sampleData1);
const sampleData4 = cloneDeep(sampleData1);

sampleData2.sale.distribution.token[ 1 ].token_ratio = "10";
sampleData3.sale.distribution.ether[ 1 ].ether_ratio = "10";
sampleData4.locker.beneficiaries[ 0 ].release[ 1 ].release_ratio = "10";

describe("Input Schema", () => {
  it("sample data 1", () => {
    const { error } = validate(sampleData1);

    should.not.exist(error);
  });

  it("should throw if toekn ratio doesn't match coeff", () => {
    const result1 = validate(sampleData2);

    should.exist(result1.error);
    result1.error.message.should.includes("token ratios");
  });

  it("should throw if ether ratio doesn't match coeff", () => {
    const result2 = validate(sampleData3);

    should.exist(result2.error);
    result2.error.message.should.includes("ether ratios");
  });

  it("should throw if last release ratio doesn't match coeff", () => {
    const result3 = validate(sampleData4);

    should.exist(result3.error);
    result3.error.message.should.includes("release ratio");
  });

  describe("#token.use_custom_token", () => {
    it("should accept if token.use_custom_token is empty", () => {
      const data = cloneDeep(sampleData1);
      const result = validate(data);

      should.not.exist(result.error);
      result.value.token.use_custom_token.should.be.equal(false);
    });

    it("should accept if token.use_custom_token is set", () => {
      const data = cloneDeep(sampleData1);
      data.token.use_custom_token = true;

      const result = validate(data);

      should.not.exist(result.error);
      result.value.token.use_custom_token.should.be.equal(true);
    });
  });

  describe("#sale.stages", () => {
    it("should throw if stage time is overlapped", () => {
      const data = cloneDeep(sampleData1);
      data.sale.stages[ 0 ].end_time = data.sale.stages[ 1 ].start_time;
      const result = validate(data);

      should.exist(result.error);
      result.error.message.should.includes("Stage should not be overlapped.");
    });

    it("should accept if token.use_custom_token is set", () => {
      const data = cloneDeep(sampleData1);
      data.token.use_custom_token = true;

      const result = validate(data);

      should.not.exist(result.error);
      result.value.token.use_custom_token.should.be.equal(true);
    });
  });
});
