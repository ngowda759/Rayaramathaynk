import re

with open("tests/unit/migration-mappers.test.ts", "r") as f:
    content = f.read()

content = content.replace(").toThrow(ValidationError, ExcludeDocumentError);", ").toThrow(ValidationError);")

with open("tests/unit/migration-mappers.test.ts", "w") as f:
    f.write(content)
