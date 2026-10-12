import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Prefer the project-local Rust toolchain when present; normal Cargo also works.
const env = { ...process.env }
if (existsSync('.tools/cargo/bin/cargo')) {
  env.CARGO_HOME = resolve('.tools/cargo')
  env.RUSTUP_HOME = resolve('.tools/rustup')
  env.PATH = `${resolve('.tools/cargo/bin')}:${env.PATH}`
}
const args = process.argv.slice(2)
const child = args[0] === 'test'
  ? spawn('cargo', ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--no-default-features', ...args.slice(1)], { stdio: 'inherit', env })
  : spawn(resolve('node_modules/.bin/tauri'), args, { stdio: 'inherit', env })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
