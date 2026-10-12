export class ClipQueue {
  constructor({load, allowed, discard, target=10, concurrency=2, changed=()=>{}}) {
    Object.assign(this,{load,allowed,discard,target,concurrency,changed});
    this.items=[]; this.loading=0; this.stopped=false; this.exhausted=false;
  }
  take() {
    while(this.items.length) {
      const item=this.items.shift();
      if(this.allowed(item)) { this.refill(); return item; }
      this.discard(item);
    }
    this.refill(); return null;
  }
  refill() {
    if(this.stopped || this.exhausted) return;
    while(this.loading<this.concurrency && this.items.length+this.loading<this.target) {
      this.loading++; this.changed(this.items.length,this.loading);
      Promise.resolve().then(()=>this.load()).then(item=>{
        if(item===null) this.exhausted=true;
        if(item && !this.stopped && this.allowed(item) && !this.items.some(other=>other.item.id===item.item.id)) this.items.push(item);
        else if(item) this.discard(item);
      }).catch(()=>{}).finally(()=>{
        this.loading--; this.changed(this.items.length,this.loading);
        if(!this.stopped) setTimeout(()=>this.refill(),250);
      });
    }
  }
  stop() { this.stopped=true; this.items.splice(0).forEach(this.discard); }
}

export function decideCut({related,elapsed,duration,remaining,ended,maxSeconds=120}) {
  if(related && (elapsed>=60 || ended || remaining<.25)) return 'related';
  if(ended || remaining<.25 || elapsed>=maxSeconds) return 'queue';
  return null;
}
