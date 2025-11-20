# Implementation

## CharPack File Format

### Binary Structure

```
+-------------------+
| Magic (4 bytes)   |  "CHPK"
+-------------------+
| Version (4)       |  uint32, current: 1
+-------------------+
| Width (4)         |  uint32
+-------------------+
| Height (4)        |  uint32
+-------------------+
| Channels (1)      |  uint8 (3=RGB, 4=RGBA)
+-------------------+
| Base Image Size(4)|  uint32
+-------------------+
| Base Image Data   |  Raw pixel data
+-------------------+
| Variation Count(4)|  uint32
+-------------------+
| Variations...     |  See variation structure
+-------------------+
```

### Variation Structure

```
For each variation:
+-------------------+
| Name Length (4)   |  uint32
+-------------------+
| Name (UTF-8)      |  String
+-------------------+
| Patch Count (4)   |  uint32
+-------------------+
| Patches...        |  See patch structure
+-------------------+
```

### Patch Structure

```
For each patch:
+-------------------+
| X (4)             |  uint32
+-------------------+
| Y (4)             |  uint32
+-------------------+
| Width (4)         |  uint32
+-------------------+
| Height (4)        |  uint32
+-------------------+
| Data Size (4)     |  uint32
+-------------------+
| Pixel Data        |  Raw RGBA data
+-------------------+
```