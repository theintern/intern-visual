import {
	RGBColor,
	RGBAColorArray,
	ColorObject,
	RGBAColor
} from '../interfaces';

/**
 * Convert a color descriptor to an RGBA value
 */
export default function getRGBA(
	color: ColorDescriptor
): RGBAColorArray | undefined {
	if (typeof color === 'number') {
		return [color, color, color, defaultColors[3]];
	}
	if (typeof color === 'string') {
		return normalize(fromString(color)!);
	}
	if (Array.isArray(color)) {
		return normalize(<number[]>color);
	}
	if (typeof color === 'object') {
		return fromObject(color);
	}
}

export type ColorDescriptor = string | RGBColor | RGBAColor | number[] | number;

const defaultColors = [0, 0, 0, 0xff];

function stringToInt(radix = 10) {
	return (str: string) => {
		if (str.length === 1) {
			str = str + str;
		}
		return parseInt(str, radix);
	};
}

function normalize(color: number[]): RGBAColorArray {
	while (color.length < 4) {
		color.push(defaultColors[color.length]);
	}
	return <RGBAColorArray>color;
}

function fromHex(color: string) {
	const rgb: string[] = [];
	color = color.replace(/[^0-9]/, '');

	const digits = color.length >= 6 ? 2 : 1;
	for (let i = 0; i < color.length; i += digits) {
		rgb.push(color.substring(i, i + digits));
	}

	return rgb.map(stringToInt(16));
}

function fromString(color: string) {
	if (color.charAt(0) === '#') {
		return fromHex(color);
	} else {
		const match = color.match(/rgb(?:a?)\(([^)]*)\)/);
		if (match && match.length === 2) {
			const convert = stringToInt();
			return match[1].split(',').map(function(value) {
				if (value.indexOf('.') === -1) {
					return convert(value);
				} else {
					return Math.min(0xff, 256 * Number(value));
				}
			});
		}
	}
}

function fromObject(color: ColorObject): RGBAColorArray {
	const rgba: number[] = [];

	rgba.push(color.red || defaultColors[0]);
	rgba.push(color.green || defaultColors[1]);
	rgba.push(color.blue || defaultColors[2]);
	rgba.push((<RGBAColor>color).alpha || defaultColors[3]);

	return <RGBAColorArray>rgba;
}
