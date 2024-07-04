import * as cheerio from "cheerio"
import { readFile, readdir, stat } from "node:fs/promises"
import * as path from "node:path"
import { kebabToCamel, kebabToPascal } from "./casing.js"
import {
  getFrontmatter,
  markdownToHtml,
  type ResolverFromFilesystem,
} from "./markdown.js"
import { loadSchema } from "./schema-loader.js"
import type { SchemaClass } from "./schema.js"
import type { Module } from "./built-data.js"
import type { Config } from "./config.js"

async function readdirNotExistOk(directory: string): Promise<string[]> {
  if (!(await stat(directory).catch(() => false))) {
    console.warn(`WARN: ${directory} does not exist.`)
    return []
  }
  const files = (await readdir(directory)).map((file) =>
    path.join(directory, file)
  )
  if (files.length === 0) {
    console.warn(`WARN: ${directory} is empty.`)
  }
  return files
}

async function typescriptFilesWithoutBarrels(
  directory: string
): Promise<string[]> {
  return (await readdirNotExistOk(directory)).filter(
    (file) =>
      file.endsWith(".ts") &&
      !file.endsWith(".d.ts") &&
      path.basename(file) !== "index.ts"
  )
}

function ellipsis(text: string, maxWords: number) {
  const words = text.split(" ")
  if (words.length <= maxWords) {
    return text
  }
  return `${words.slice(0, maxWords).join(" ")}...`
}

function firstSentence(text: string) {
  return text.split(/\.(\s|$)/)[0]
}

/**
 * Sort types such that a type comes before another if it is used by the other.
 */
function typesTopologicalSorter(
  schema: SchemaClass
): (
  aName: Module["types"][number],
  bName: Module["types"][number]
) => -1 | 0 | 1 {
  return (aName, bName) => {
    if (aName === bName) {
      return 0
    }
    const a = findTypeInSchema(schema, aName)
    const b = findTypeInSchema(schema, bName)
    if (!a || !b) {
      console.warn(
        `WARN: could not find types ${aName} and/or ${bName} in schema.`
      )
      return 0
    }
    const aUsedByB =
      b.fields?.some((field) =>
        [
          field.type.name,
          field.type.ofType?.name,
          field.type?.ofType?.ofType?.name,
        ].includes(a.name)
      ) || b.interfaces?.some((i) => i.name === a.name)
    const bUsedByA =
      a.fields?.some((field) =>
        [
          field.type.name,
          field.type.ofType?.name,
          field.type?.ofType?.ofType?.name,
        ].includes(b.name)
      ) || a.interfaces?.some((i) => i.name === b.name)

    if (aUsedByB && bUsedByA) {
      return 0
    }

    if (aUsedByB) {
      return 1
    }

    if (bUsedByA) {
      return -1
    }

    return 0
  }
}

export async function getModule(config: Config, name: string): Promise<Module> {
  const folder = path.join("../api/src/modules", name)
  if (!(await stat(folder).catch(() => false)))
    throw new Error(`Module ${name} does not exist: ${folder} not found.`)
  const docs = await readFile(path.join(folder, "README.md"), "utf-8")

  const { parsedDocs, metadata, ...documentation } =
    await parseDocumentation(docs)

  const module: Module = {
    name: name,
    displayName: parsedDocs("h1").first().text(),
    ...documentation,
    types: (await typescriptFilesWithoutBarrels(path.join(folder, "types")))
      .map((file) => kebabToPascal(path.basename(file, ".ts")))
      .sort(typesTopologicalSorter(await loadSchema(config))),
    queries: [],
    mutations: [],
    subscriptions: [],
  }

  for (const filepath of await typescriptFilesWithoutBarrels(
    path.join(folder, "resolvers")
  )) {
    const filename = path.basename(filepath)
    if (filename.startsWith("query")) {
      module.queries.push(
        kebabToCamel(filename.replace(/^query\./, "").replace(/\.ts$/, ""))
      )
    }

    if (filename.startsWith("mutation")) {
      module.mutations.push(
        kebabToCamel(filename.replace(/^mutation\./, "").replace(/\.ts$/, ""))
      )
    }

    if (filename.startsWith("subscription")) {
      module.subscriptions.push(
        kebabToCamel(
          filename.replace(/^subscription\./, "").replace(/\.ts$/, "")
        )
      )
    }
  }

  if (metadata.manually_include) {
    for (const query of metadata.manually_include.queries ?? []) {
      module.queries.push(query)
    }
    for (const mutation of metadata.manually_include.mutations ?? []) {
      module.mutations.push(mutation)
    }
    for (const subscription of metadata.manually_include.subscriptions ?? []) {
      module.subscriptions.push(subscription)
    }
    for (const type of metadata.manually_include.types ?? []) {
      module.types.push(type)
    }
  }

  if (
    module.types.length === 0 &&
    module.queries.length === 0 &&
    module.mutations.length === 0 &&
    module.subscriptions.length === 0
  ) {
    console.warn(
      `WARN: ${name} has no types nor resolvers. Files found...\n\tIn ${path.join(
        folder,
        "types"
      )}: ${(await typescriptFilesWithoutBarrels(path.join(folder, "types")))
        .map((f) => path.basename(f))
        .join(", ")}\n\tIn ${path.join(folder, "resolvers")}: ${(
        await typescriptFilesWithoutBarrels(path.join(folder, "resolvers"))
      )
        .map((f) => path.basename(f))
        .join(", ")}`
    )
  }

  return module
}

export async function parseDocumentation(docs: string) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const metadata: Record<string, any> = await getFrontmatter(docs)
  const htmlDocs = await markdownToHtml(docs, await getAllResolvers(), {
    downlevelHeadings: false,
  })
  const parsedDocs = cheerio.load(htmlDocs)
  const docsWithoutHeading = cheerio.load(htmlDocs)
  docsWithoutHeading("h1").remove()

  //   if (Object.keys(metadata).length > 0) {
  //     console.log(`Found metadata for ${name}: ${JSON.stringify(metadata)}`)
  //   }

  return {
    rawDocs: docs,
    shortDescription: ellipsis(
      firstSentence(docsWithoutHeading("p").first().text()),
      15
    ),
    renderedDocs: docsWithoutHeading.html() ?? "",
    metadata,
    parsedDocs,
  }
}

export async function getAllModules(config: Config) {
  const order =
    config.modules?.filesystem?.order ??
    config.modules?.static?.map((m) => m.name) ??
    []
  return (
    await Promise.all(
      (await readdir("../api/src/modules")).map(async (folder) =>
        getModule(config, folder)
      )
    )
  )
    .filter(
      (m) => m.mutations.length + m.queries.length + m.subscriptions.length > 0
    )
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
}

let allResolvers: ResolverFromFilesystem[] = []

export async function getAllResolvers(): Promise<ResolverFromFilesystem[]> {
  if (allResolvers.length > 0) {
    return allResolvers
  }
  const modules = await readdirNotExistOk("../api/src/modules")
  const resolvers: ResolverFromFilesystem[] = []
  for (const module of modules) {
    for (const resolver of await typescriptFilesWithoutBarrels(
      path.join(module, "resolvers")
    )) {
      const rootResolverPrefix = /^(query|mutation|subscription)\./
      if (rootResolverPrefix.test(path.basename(resolver))) {
        resolvers.push({
          name: kebabToCamel(
            path
              .basename(resolver)
              .replace(rootResolverPrefix, "")
              .replace(/\.ts$/, "")
          ),
          moduleName: path.basename(module),
          type: path.basename(resolver).split(".")[0] as
            | "query"
            | "mutation"
            | "subscription",
        })
        // console.log(
        // 	`Found resolver ${path.basename(resolver)} in ${module}: ${JSON.stringify(
        // 		resolvers.at(-1)
        // 	)}`
        // );
      }
    }
  }

  console.warn(
    `WARN: no resolvers found. Searched in ${modules
      .map((m) => path.join(m, "resolvers"))
      .join(", ")}`
  )

  allResolvers = resolvers
  return resolvers
}

const BUILTIN_TYPES = ["String", "Boolean", "Int", "Float"]

export async function indexModule(config: Config): Promise<Module> {
  const schema = await loadSchema(config)
  const { description, title } =
    typeof config.modules?.index === "object"
      ? {
          description:
            config.modules.index.description ?? "The entire GraphQL schema",
          title: config.modules.index.title ?? "Index",
        }
      : { description: "The entire GraphQL schema", title: "Index" }

  const { renderedDocs, shortDescription, rawDocs } =
    await parseDocumentation(description)

  return {
    displayName: title,
    rawDocs,
    renderedDocs,
    shortDescription,
    name: "index",
    mutations:
      schema.types
        .find(
          (type) => type.name === (schema.mutationType ?? { name: "" }).name
        )
        ?.fields?.map((field) => field.name) ?? [],
    queries:
      schema.types
        .find((type) => type.name === schema.queryType.name)
        ?.fields?.map((field) => field.name) ?? [],
    subscriptions:
      schema.types
        .find(
          (type) =>
            type.name === (schema.subscriptionType ?? { name: "" })?.name
        )
        ?.fields?.map((field) => field.name) ?? [],
    types: schema.types
      .map((t) => t.name)
      .filter(
        (n) =>
          ![
            schema.queryType.name,
            (schema.mutationType ?? { name: "" }).name,
            (schema.subscriptionType ?? { name: "" })?.name,
          ].includes(n) &&
          !BUILTIN_TYPES.includes(n) /* &&
					!/(Connection|Edge|Success)$/.test(n) */ &&
          !n.startsWith("__") /* &&
					!/^(Query|Mutation|Subscription)\w+(Result|Success)$/.test(n) */
      ),
  } as Module
}

export function findTypeInSchema(schema: SchemaClass, name: string) {
  const type = schema.types.find((type) => type.name === name)

  if (!type) console.error(`Not found in schema: Type ${name}`)

  return type
}
