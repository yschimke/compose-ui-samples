package androidx.annotation

/**
 * A local stand-in for AndroidX's `@Sampled`, which **no published artifact provides**.
 *
 * The same declaration yschimke/m3-catalog's samples modules carry, for the same reason: it keeps
 * the vendored tree byte-identical to upstream, because the alternative is rewriting every imported
 * file to strip an annotation and making each one a modified file forever. `Sampled` is an
 * AOSP-internal marker the docs tooling reads to pair a `@sample` tag with the function it names,
 * and it is deliberately not shipped — `androidx.annotation:annotation` does not contain it and
 * `androidx.annotation:annotation-sampled` does not exist on Google Maven.
 *
 * It carries no behaviour and nothing reads it at runtime — `scripts/samples-previews.mjs` reads
 * the annotation from **source text**, not from the classpath. If AndroidX ever publishes the real
 * one, delete this file.
 */
@Retention(AnnotationRetention.BINARY)
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.PROPERTY, AnnotationTarget.CLASS)
annotation class Sampled
