import { expect, test } from "bun:test";
import type { AnyCircuitElement, PcbTrace, SourceTrace } from "circuit-json";
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg";
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew";
import { bus } from "../fixtures/length-matching";

test("measures complete pad-to-pad paths in the same units for a skew-only bus", async () => {
	const elements: AnyCircuitElement[] = [
		{ ...bus(0.1), name: "DATA" },
		{
			type: "pcb_board",
			pcb_board_id: "board",
			center: { x: 4, y: 1.5 },
			width: 14,
			height: 8,
			thickness: 1.6,
			num_layers: 2,
			material: "fr4",
		},
	];
	for (const [row, id] of ["a", "b"].entries()) {
		const pins = [id + "1", id + "2"];
		const source: SourceTrace = {
			type: "source_trace",
			source_trace_id: id,
			connected_source_port_ids: pins,
			connected_source_net_ids: [],
		};
		elements.push(source);
		for (const [end, pin] of pins.entries()) {
			elements.push({
				type: "pcb_port",
				pcb_port_id: "pad" + pin,
				source_port_id: pin,
				pcb_component_id: pin,
				x: end * 8,
				y: row * 2,
				layers: [end === 1 && row === 1 ? "bottom" : "top"],
			});
		}
		const route: PcbTrace["route"] = [
			{ route_type: "wire", x: 0, y: row * 2, layer: "top", width: 0.15 },
		];
		if (row)
			route.push({
				route_type: "via",
				x: 4,
				y: row * 2,
				from_layer: "top",
				to_layer: "bottom",
			});
		route.push({
			route_type: "wire",
			x: 8,
			y: row * 2,
			layer: row ? "bottom" : "top",
			width: 0.15,
		});
		elements.push({
			type: "pcb_trace",
			pcb_trace_id: "trace" + id,
			source_trace_id: id,
			route,
		});
	}
	const errors = checkPcbBusLengthSkew(elements);
	expect(errors[0]?.actual_length_skew).toBeCloseTo(1.6);
	elements.push(
		{
			type: "pcb_via",
			pcb_via_id: "DATA_via",
			x: 4,
			y: 2,
			layers: ["top", "bottom"],
			outer_diameter: 0.5,
			hole_diameter: 0.25,
		},
		{
			type: "pcb_note_text",
			pcb_note_text_id: "skew",
			text: `DATA   8 mm per trace   ${errors[0]?.actual_length_skew.toFixed(2) ?? "0.00"} mm skew reported`,
			anchor_position: { x: 4, y: 4.2 },
			anchor_alignment: "center",
			font: "tscircuit2024",
			font_size: 0.49,
			layer: "top",
		},
	);
	await expect(
		convertCircuitJsonToPcbSvg(elements, { includeVersion: false }),
	).toMatchSvgSnapshot(import.meta.path);
	const trace = elements.find(
		(e): e is PcbTrace => e.type === "pcb_trace" && e.source_trace_id === "a",
	)!;
	trace.route.splice(1, 0, {
		route_type: "wire",
		x: 4,
		y: -3,
		layer: "top",
		width: 0.15,
	});
	expect(checkPcbBusLengthSkew(elements)[0]?.actual_length_skew).toBeCloseTo(
		0.4,
	);
});
