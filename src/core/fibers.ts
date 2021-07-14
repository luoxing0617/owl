import type { Block } from "../bdom";
import { STATUS } from "../status";
import { OwlNode } from "./owl_node";

export class Fiber {
  node: OwlNode;
  bdom: Block | null = null;
  isCompleted: boolean = false;
  root: RootFiber;
  parent: Fiber | null;
  children: Fiber[] = [];

  constructor(node: OwlNode, parent: Fiber | null) {
    this.node = node;
    node.fiber = this as any;
    this.parent = parent;
    if (parent) {
      const root = parent.root;
      root.counter++;
      this.root = root;
      root.children.push(this);
    } else {
      this.root = this as any;
    }
  }
}

export class RootFiber extends Fiber {
  counter: number;
  error: Error | null;
  resolve: any;
  promise: any;
  reject: any;
  toPatch: OwlNode[];

  constructor(node: OwlNode) {
    const oldFiber = node.fiber;
    super(node, null);
    this.counter = 1;
    this.error = null;
    this.root = this;
    this.toPatch = [node];
    if (oldFiber instanceof RootFiber) {
      this._reuseFiber(oldFiber);
      return oldFiber;
    }

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  _reuseFiber(oldFiber: RootFiber) {
    // cancel old fibers
    for (let fiber of oldFiber.children) {
      fiber.isCompleted = true;
    }
    oldFiber.toPatch = [];
    oldFiber.children = [];
    oldFiber.counter = 1;
    oldFiber.isCompleted = false;
  }

  complete() {
    const node = this.node;
    // if (node.fiber !== fiber) {
    //   return;
    // }
    for (let node of this.toPatch) {
      node.callBeforePatch();
    }
    const mountedNodes: any[] = [];
    const patchedNodes: any[] = [node];
    node.bdom!.patch(this.bdom!, mountedNodes, patchedNodes);
    this.finalize(mountedNodes, patchedNodes);
    node.fiber = null;
  }

  finalize(mounted: OwlNode[], patched: OwlNode[]) {
    let current;
    while ((current = mounted.pop())) {
      for (let cb of current.mounted) {
        cb();
      }
    }
    while ((current = patched.pop())) {
      for (let cb of current.patched) {
        cb();
      }
    }
  }
}

export class MountFiber extends RootFiber {
  target: HTMLElement;

  constructor(node: OwlNode, target: HTMLElement) {
    super(node);
    this.target = target;
    this.toPatch = [];
  }
  complete() {
    const node = this.node;
    node.bdom = this.bdom;
    const mountedNodes: any[] = [node];
    const patchedNodes: any[] = [];
    node.bdom!.mount(this.target, mountedNodes, patchedNodes);
    this.finalize(mountedNodes, patchedNodes);
    node.status = STATUS.MOUNTED;
    node.fiber = null;
  }
}
