const codefn = ()=>{
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    let a = "";
    for (let i = 0; i < 6; i++) {
        let num = Math.floor(Math.random() * 62);
        a += chars[num];
    }
    return a;
}

module.exports = codefn;