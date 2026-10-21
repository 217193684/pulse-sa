/** Category rules and place pinning. */
import { describe, expect, it } from "vitest";
import { FORECAST, classify } from "../src/server/classify";
import { findPlace } from "../src/server/geo/places";
import { youtubeId } from "../src/server/youtube";
import { parseProblemId, problemId, trendLabel } from "../src/server/problems";

describe("classify", () => {
  it.each([
    ["Umlazi residents without water for third day", "water"],
    ["Burst pipe leaves Soweto with dry taps", "water"],
    ["Eskom announces stage 4 load shedding tonight", "power"],
    ["Power outage hits parts of Tshwane after substation fire", "power"],
    ["NSFAS students say portal rejects documents", "education"],
    ["Matric exam papers leak investigated", "education"],
    ["Mine announces 2,000 retrenchments", "jobs"],
    ["SASSA SRD grant payment dates confirmed", "grants"],
    ["Petrol price hike expected in November", "cost"],
    ["Cholera outbreak confirmed in Hammanskraal", "health"],
    ["Taxi strike leaves commuters stranded", "transport"],
    ["Service delivery protest blocks N2", "safety"],
  ])("%s → %s", (text, cat) => expect(classify(text)).toBe(cat));

  it("sorts other news into news categories, and keeps them off the problem map", () => {
    expect(classify("Springbok coach names squad")).toBe("sport");
    expect(classify("Kaizer Chiefs win the derby")).toBe("sport");
    expect(classify("Book review: a new novel")).toBeNull();
    for (const t of ["Springbok coach names squad", "Kaizer Chiefs win the derby"]) expect(classify(t, true)).toBeNull();
  });
  it("news the newsroom cares about", () => {
    expect(classify("Petrol price to drop by 50c in November")).toBe("cost");
    expect(classify("SANTACO warns of taxi industry shutdown")).toBe("transport");
    expect(classify("Department of Health is hiring: 300 nurse vacancies open")).toBe("jobs");
    expect(classify("Learner from Soweto wins national science award")).toBe("good");
    expect(classify("SAWS issues orange level 6 warning for disruptive rain")).toBe("weather");
  });
  it("spots forecasts so they can be labelled as expected, not fact", () => {
    expect(FORECAST.test("Petrol price expected to drop in November, mid-month data shows")).toBe(true);
    expect(FORECAST.test("Petrol price drops by 50c tonight")).toBe(false);
  });

  it("a taxi strike is transport, not a general 'strike'", () => expect(classify("Taxi strike in Durban")).toBe("transport"));
  it("'strike' only counts as industrial action", () => {
    expect(classify("Police strike major blow to KZN drug trade")).toBeNull();
    expect(classify("Municipal workers go on strike over wages")).toBe("safety");
  });
});

describe("findPlace", () => {
  it("pins suburbs to their metro and prefers towns over provinces", () => {
    expect(findPlace("Umlazi residents without water")?.slug).toBe("ethekwini");
    expect(findPlace("Mitchells Plain and Parow hit by outage")?.slug).toBe("cape-town");
    expect(findPlace("Port Elizabeth water crisis")?.slug).toBe("nelson-mandela-bay");
    expect(findPlace("NSFAS students in Gauteng complain")?.slug).toBe("gauteng");
    expect(findPlace("Outage in Soweto, Gauteng")?.slug).toBe("johannesburg");
    expect(findPlace("KZN floods")?.slug).toBe("kwazulu-natal");
    expect(findPlace("Mandlanzini taps run dry")?.slug).toBe("umhlathuze");
  });
  it("doesn't pin on common words, names or lowercase text", () => {
    expect(findPlace("George says the springs are dry")).toBeNull();
    expect(findPlace("the strand of hair")).toBeNull();
    expect(findPlace("Durbanville")?.slug).toBe("cape-town"); // not Durban
  });
});

describe("ids and helpers", () => {
  it("problem ids round-trip and reject junk", () => {
    expect(parseProblemId(problemId("water", "ethekwini"))).toEqual({ category: "water", placeSlug: "ethekwini" });
    expect(parseProblemId("power~za")).toEqual({ category: "power", placeSlug: null });
    for (const bad of ["water", "nope~za", "water~atlantis", "trending~za", "water~../x"]) expect(parseProblemId(bad)).toBeNull();
  });
  it("trend labels", () => {
    expect(trendLabel(null)).toBe("New today");
    expect(trendLabel(4)).toBe("Much more than usual");
    expect(trendLabel(1.6)).toBe("More than usual");
    expect(trendLabel(1)).toBe("Around normal");
    expect(trendLabel(0.2)).toBe("Quieter than usual");
  });
  it("youtube links", () => {
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
  });
});
