# applies supported formatting rules

## 输入
```text
this is ;;abc;; and ;;def;; or ;; and else
this is ;;+ hehehe ;;kjsdfk;;klsdjfie
prefix ;;+ hello ;;name;;
before ;; still open
keep `;;code;;` but change ;;text;;
- abc
1. abc
```

## 预期输出
```text
this is `abc` and `def` or ;; and else
this is ` hehehe ;;kjsdfk;;klsdjfie`
prefix ` hello ;;name;;`
before ;; still open
keep `;;code;;` but change `text`
- abc  
1. abc  
```
