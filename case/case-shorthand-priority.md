# applies ;;+ before inline replacements on the same line

## 输入
```text
prefix ;;+ hello ;;name;;
```

## 预期输出
```text
prefix ` hello ;;name;;`
```
