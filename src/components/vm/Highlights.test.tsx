import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Highlights } from "./Highlights";

describe("faixa de destaques", () => {
  it("não aparece quando não há posts de professores", () => {
    const { container } = render(<Highlights posts={[]} users={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
