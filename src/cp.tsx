import {cp} from "fs";

export function CopyAssests() {
    cp(`${process.cwd()}/src/default.png`, `${process.cwd()}/build/default.png`, (err) => {
        err && console.log(err)
    })
}


export function CopyDefaultImage() {
    cp(`${process.cwd()}/build/default.png`, `${process.cwd()}/build/background.png`, (err) => {
        err && console.log(err)
    })
}
