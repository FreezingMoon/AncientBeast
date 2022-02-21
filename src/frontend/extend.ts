import { extend } from "jquery";

export function shallow_extend(obj1: any, obj2: any) {
	return extend(false, obj1, obj2);
}

export function deep_extend(obj1: any, obj2: any) {
	return extend(true, obj1, obj2);
}
