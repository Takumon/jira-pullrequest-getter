## お試し diff

- そんなことないよ
- いえ

```diff
@@ -1,5 +1,17 @@
 package nablarch.core.validation.validator;

+import static org.hamcrest.CoreMatchers.*;
+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertFalse;
+import static org.junit.Assert.assertThat;
+import static org.junit.Assert.assertTrue;
+import static org.junit.Assert.fail;
+
+import java.lang.annotation.Annotation;
+import java.util.HashMap;
+import java.util.Locale;
+import java.util.Map;
+
 import nablarch.core.ThreadContext;
 import nablarch.core.message.MockStringResourceHolder;
 import nablarch.core.repository.SystemRepository;
@@ -8,18 +20,10 @@
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.convertor.TestTarget;
 import nablarch.core.validation.creator.ReflectionFormCreator;
+
 import org.junit.Before;
 import org.junit.Test;

-import java.lang.annotation.Annotation;
-import java.util.HashMap;
-import java.util.Locale;
-import java.util.Map;
-
-import static org.hamcrest.CoreMatchers.instanceOf;
-import static org.hamcrest.CoreMatchers.is;
-import static org.junit.Assert.*;
-

 public class LengthValidatorTest {

@@ -82,7 +86,8 @@ public void testValidateSuccess() {

         assertTrue(testee.validate(context, "param", "PROP0001", length, "12345"));
         assertTrue(testee.validate(context, "param", "PROP0001", length, "1234567"));
-        assertTrue(testee.validate(context, "param", "PROP0001", length, "1234567890"));
+        assertTrue(testee.validate(context, "param", "PROP0001", length, "1234567890"));
+        assertTrue("nullはOK", testee.validate(context, "param", "PROP0001", length, null));
     }
     @Test
     public void testValidateLonger() {
@@ -159,7 +164,7 @@ public int max() {
     @Test
     public void testValidateMulti() {

-        assertTrue(testee.validate(context, "param", "PROP0001", length, new String[] {"12345", "0123456789"}));
+        assertTrue(testee.validate(context, "param", "PROP0001", length, new String[] {"12345", "0123456789", null}));
         assertFalse(testee.validate(context, "param", "PROP0001", length, new String[] {"12345", "01234567890", "1234"}));

         assertEquals(1, context.getMessages().size());
```

`<span>ge</span>`

```diff
diff --git a/build.gradle b/build.gradle
index de19af9..28c8dc2 100644
--- a/build.gradle
+++ b/build.gradle
@@ -1,5 +1,5 @@
 group = 'com.nablarch.framework'
-version = '1.0.3'
+version = '1.0.4'
 description = 'バリデーション機能'
V
 buildscript {
diff --git a/gradle/wrapper/gradle-wrapper.properties b/gradle/wrapper/gradle-wrapper.properties
index 166c20b..25e202f 100644
--- a/gradle/wrapper/gradle-wrapper.properties
+++ b/gradle/wrapper/gradle-wrapper.properties
@@ -1,6 +1,6 @@
-#Wed Mar 15 17:44:43 JST 2017
+#Thu Sep 28 09:11:18 JST 2017
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
 zipStoreBase=GRADLE_USER_HOME
 zipStorePath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-2.13-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-2.13-all.zip
diff --git a/src/main/java/nablarch/core/validation/convertor/BooleanConvertor.java b/src/main/java/nablarch/core/validation/convertor/BooleanConvertor.java
index 6704581..8f9d006 100644
--- a/src/main/java/nablarch/core/validation/convertor/BooleanConvertor.java
+++ b/src/main/java/nablarch/core/validation/convertor/BooleanConvertor.java
@@ -53,53 +53,69 @@ public void setAllowNullValue(boolean allowNullValue) {

         if (value == null) {
             return Boolean.FALSE;
-
+        } else if (value instanceof Boolean) {
+            return value;
         } else if (value instanceof String[]) {
-            value = ((String[]) value)[0];
+            final String[] values = (String[]) value;
+            return values[0] == null ? false : Boolean.valueOf(values[0]);
+        } else {
+            return Boolean.valueOf(value.toString());
         }
-
-        Boolean ret = Boolean.parseBoolean(value.toString());
-
-        return ret;
     }

-    /**
-     * {@inheritDoc}
-     */
+    @Override
     public Class<?> getTargetClass() {
         return Boolean.class;
     }

-    /**
-     * {@inheritDoc}
-     */
+    @Override
     public <T> boolean isConvertible(ValidationContext<T> context,
             String propertyName, Object propertyDisplayName, Object value,
             Annotation format) {
-
-        boolean convertible = false;
+
+        final boolean convertible = isConvertible(value);
+        if (!convertible) {
+            ValidationResultMessageUtil.addResultMessage(context, propertyName,
+                                                        conversionFailedMessageId, propertyDisplayName);
+        }
+        return convertible;
+    }
+
+    /**
+     * 値がbooleanに変換可能かを返す。
+     *
+     * @param value 値
+     * @return 変換可能な場合は{@code true}
+     */
+    private boolean isConvertible(final Object value) {
         if (value == null && allowNullValue) {
             return true;
+        } else if (value instanceof Boolean) {
+            return true;
         } else if (value instanceof String) {
-            convertible = true;
+            return isBooleanString((String) value);
         } else if (value instanceof String[]) {
-            if (((String[]) value).length == 1) {
-                value = ((String[]) value)[0];
-                convertible = true;
+            final String[] values = (String[]) value;
+            if (values.length != 1) {
+                return false;
+            } else {
+                final String str = values[0];
+                if (str == null) {
+                    return allowNullValue;
+                } else {
+                    return isBooleanString(str);
+                }
             }
         }
+        return false;
+    }

-        if (value != null && value.toString().matches("[tT][rR][uU][eE]|[fF][aA][lL][sS][eE]")) {
-            convertible = true;
-        } else {
-            convertible = false;
-        }
-
-        if (!convertible) {
-            ValidationResultMessageUtil.addResultMessage(context, propertyName,
-                                                        conversionFailedMessageId, propertyDisplayName);
-        }
-
-        return convertible;
+    /**
+     * 真偽値の文字列表記(大文字小文字は区別しない)にマッチするか否かを返す。
+     * @param value 値
+     * @return 値が真偽値の文字列表記の場合は{@code true}
+     */
+    private boolean isBooleanString(final String value) {
+        return value.matches("(?i)true|false");
     }
 }
diff --git a/src/main/java/nablarch/core/validation/convertor/NumberConvertorSupport.java b/src/main/java/nablarch/core/validation/convertor/NumberConvertorSupport.java
index 5b713c0..550e1a8 100644
--- a/src/main/java/nablarch/core/validation/convertor/NumberConvertorSupport.java
+++ b/src/main/java/nablarch/core/validation/convertor/NumberConvertorSupport.java
@@ -19,11 +19,13 @@
 /**
  * 数値のコンバータの作成を助けるサポートクラス。</br>
  * 数値のコンバータは変換前にバリデーションを行うが、各コンバータが行う共通バリデーションは当クラスにて行う。
- * 共通バリデーションの仕様は次の通りである。
+ * <p>
+ * 共通バリデーションでは、以下のいずれかの場合、バリデーションOKとする。
  * <ul>
- *     <li>allowNullValueがfalseの時に、入力値がnullでないこと。</li>
- *     <li>入力値がNumber、String、String配列のいずれかのインスタンスであること。</li>
- *     <li>入力値がString配列である場合、要素数が1であること。</li>
+ * <li>値がnullでnullを許容している場合({@link #allowNullValue}がtrueの場合)</li>
+ * <li>値がNumberに代入可能な型の場合</li>
+ * <li>値がString型の場合</li>
+ * <li>値がString配列で要素数が1の場合(配列内の値がnullの場合は{@link #allowNullValue}がtrueの場合)</li>
  * </ul>
  *
  * <p>
@@ -116,19 +118,15 @@ public void setAllowNullValue(boolean allowNullValue) {
     public <T> boolean isConvertible(ValidationContext<T> context,
             String propertyName, Object propertyDisplayName, Object value,
             Annotation format) {
+
         // チェック対象の値の型が正しいか
-        boolean isConvertibleType
-                = (value == null && allowNullValue)
-               || (value instanceof Number)
-               || (value instanceof String)
-               || (value instanceof String[] && ((String[]) value).length == 1);
-        if (!isConvertibleType) {
+        if (!isConvertible(value)) {
             ValidationResultMessageUtil.addResultMessage(context, propertyName,
                     multiInputMessageId, propertyDisplayName);
             return false;
         }

-        if (value == null) {
+        if (isNullValue(value)) {
             // nullの場合は以降の処理は行わない。
             // nullを許可している場合のみ、ここまで処理がくる。
             return true;
@@ -153,6 +151,47 @@ public void setAllowNullValue(boolean allowNullValue) {
         return true;
     }

+    /**
+     * 値がnullかどうかを返す。
+     * <p>
+     * 値がnullの場合または、値がサイズ1の配列で唯一の要素がnullの場合に{@code true}を返す。
+     *
+     * @param value 値
+     * @return nullの場合{@code true}
+     */
+    private boolean isNullValue(final Object value) {
+        if (value == null) {
+            return true;
+        } else if (value instanceof String[]) {
+            if (((String[]) value)[0] == null) {
+                return true;
+            }
+        }
+        return false;
+    }
+
+    /**
+     * {@link Number}に変換可能かを返す。
+     *
+     * @param value 値
+     * @return 変換可能な場合は{@code true}
+     */
+    private boolean isConvertible(final Object value) {
+        if (value == null && allowNullValue) {
+            return true;
+        } else if (value instanceof Number) {
+            return true;
+        } else if (value instanceof String) {
+            return true;
+        } else if (value instanceof String[] && ((String[]) value).length == 1) {
+            if (((String[]) value)[0] == null) {
+                return allowNullValue;
+            }
+            return true;
+        }
+        return false;
+    }
+
     /**
      * バリデーション対象の値がパターンにマッチするかチェックする。
      *
@@ -235,26 +274,26 @@ private String getMessageId(Digits digits) {
      * @return 変換後の文字列
      */
     protected String convertToString(Object value) {
-        String str;
-        if (value instanceof String) {
-            str = (String) value;
-        } else if (value instanceof BigDecimal) {
-        	str = ((BigDecimal) value).toPlainString();
+        if (value instanceof BigDecimal) {
+            return ((BigDecimal) value).toPlainString();
         } else if (value instanceof Number) {
-            str = value.toString();
+            return value.toString();
+        } else if (value instanceof String) {
+            return trim((String) value);
         } else if (value instanceof String[]) {
-            String[] arg = (String[]) value;
-            if (arg.length == 1) {
-                str = arg[0];
+            String[] strings = (String[]) value;
+            if (strings.length == 1) {
+                if (strings[0] == null) {
+                    return null;
+                } else {
+                    return trim(strings[0]);
+                }
             } else {
                 return null;
             }
         } else {
             return null;
         }
-
-        // トリム
-        return trim(str);
     }

     /**
diff --git a/src/main/java/nablarch/core/validation/convertor/StringArrayConvertor.java b/src/main/java/nablarch/core/validation/convertor/StringArrayConvertor.java
index b1273de..d602328 100644
--- a/src/main/java/nablarch/core/validation/convertor/StringArrayConvertor.java
+++ b/src/main/java/nablarch/core/validation/convertor/StringArrayConvertor.java
@@ -13,26 +13,17 @@
  */
 public class StringArrayConvertor implements Convertor {

-    /**
-     * {@inheritDoc}
-     */
+    @Override
     public <T> Object convert(ValidationContext<T> context, String propertyName, Object value, Annotation format) {
-
-        String[] values = (String[]) value;
-
-        return values;
+        return (String[]) value;
     }

-    /**
-     * {@inheritDoc}
-     */
+    @Override
     public Class<?> getTargetClass() {
         return String[].class;
     }

-    /**
-     * {@inheritDoc}
-     */
+    @Override
     public <T> boolean isConvertible(ValidationContext<T> context,
             String propertyName, Object propertyDisplayName, Object value,
             Annotation format) {
diff --git a/src/main/java/nablarch/core/validation/convertor/StringConvertor.java b/src/main/java/nablarch/core/validation/convertor/StringConvertor.java
index 286a29c..99e0a76 100644
--- a/src/main/java/nablarch/core/validation/convertor/StringConvertor.java
+++ b/src/main/java/nablarch/core/validation/convertor/StringConvertor.java
@@ -186,7 +186,15 @@ private Convertor getConvertorRelatedToFormat(Annotation format) {
         } else if (value instanceof String[]) {
             if (((String[]) value).length == 1) {
                 value = ((String[]) value)[0];
-                convertible = true;
+                if (value == null) {
+                    if (allowNullValue) {
+                        return true;
+                    } else {
+                        convertible = false;
+                    }
+                } else {
+                    convertible = true;
+                }
             }
         }

diff --git a/src/main/java/nablarch/core/validation/validator/CharacterLimitationValidator.java b/src/main/java/nablarch/core/validation/validator/CharacterLimitationValidator.java
index 2648d58..4a75dce 100644
--- a/src/main/java/nablarch/core/validation/validator/CharacterLimitationValidator.java
+++ b/src/main/java/nablarch/core/validation/validator/CharacterLimitationValidator.java
@@ -44,6 +44,9 @@ public void setMessageId(String messageId) {
     public <T> boolean validateSingleValue(ValidationContext<T> context,
             String propertyName, Object propertyDisplayObject,
             A annotation, String value) {
+        if (value == null) {
+            return true;
+        }
         if (!isValid(annotation, value)) {
             String messageIdFromAnnotation = getMessageIdFromAnnotation(annotation);
             if (!StringUtil.isNullOrEmpty(messageIdFromAnnotation)) {
@@ -57,8 +60,9 @@ public void setMessageId(String messageId) {
     }
     /**
      * 有効文字以外が入力されていないかをチェックする。
+     *
      * @param annotation アノテーション
-     * @param value バリデーション対象の値
+     * @param value バリデーション対象の値(null以外)
      * @return 有効文字以外が入力されていない場合true
      */
     @Published(tag = "architect")
diff --git a/src/main/java/nablarch/core/validation/validator/LengthValidator.java b/src/main/java/nablarch/core/validation/validator/LengthValidator.java
index d7b340f..4e47282 100644
--- a/src/main/java/nablarch/core/validation/validator/LengthValidator.java
+++ b/src/main/java/nablarch/core/validation/validator/LengthValidator.java
@@ -3,6 +3,7 @@
 import java.lang.annotation.Annotation;
 import java.util.Map;

+import nablarch.core.util.StringUtil;
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.ValidationResultMessageUtil;

@@ -71,9 +72,11 @@ public void setFixLengthMessageId(String fixLengthMessageId) {
      */
     public <T> boolean validateSingleValue(ValidationContext<T> context, String propertyName,
             Object propertyDisplayName, Length length, String value) {
-        // 文字列長 0 は @Required で防ぐ前提であるため、無条件で許可する
-        // 例えば文字列長が 0 (入力なし) または 8 のみを許可するために使用する
-        if (length.min() > 0 && value.length() != 0) {
+        // 空文字列及びnullは、必須入力(Required)で防ぐ前提であるため、無条件で許可する
+        if (StringUtil.isNullOrEmpty(value)) {
+            return true;
+        }
+        if (length.min() > 0) {
             if (value.length() < length.min()) {
                 addMessage(context, propertyName, propertyDisplayName, length);
                 return false;
diff --git a/src/test/java/nablarch/core/validation/ValidationManagerTest.java b/src/test/java/nablarch/core/validation/ValidationManagerTest.java
index f6eaf86..8349a7f 100644
--- a/src/test/java/nablarch/core/validation/ValidationManagerTest.java
+++ b/src/test/java/nablarch/core/validation/ValidationManagerTest.java
@@ -26,6 +26,7 @@
 import nablarch.core.validation.validator.Length;
 import nablarch.core.validation.validator.NumberRange;
 import nablarch.core.validation.validator.Required;
+import nablarch.core.validation.validator.unicode.SystemChar;
 import nablarch.test.support.SystemRepositoryResource;

 import org.junit.Before;
@@ -49,6 +50,9 @@
         { "User.id", "ja","ID", "en","ID"},
         { "User.name", "ja","名前", "en","Name"},
         { "User.age", "ja","年齢", "en","Age"},
+        { "User.array", "ja", "配列", "en", "Array"},
+        { "User.systemChar", "ja", "文字列", "en", "string"},
+        { "User.num", "ja", "数値", "en", "num"},
         { "StringArrayValueHolder.code", "ja","コード", "en","code"},
         { "MSG00001", "ja","{0}の値が不正です。","en","{0} value is invalid."},
         { "MSG00011","ja","{0}は必ず入力してください。","en","{0} is required."},
@@ -63,6 +67,7 @@
         { "PROP0001","ja","名前","en","Name"},
         { "PROP0002","ja","ユーザ氏名","en","User Name"},
         { "PROP0003","ja","備考","en","Remarks"},
+        { "systemchar.message", "ja", "NG", "en", "NG"}
        };

     @BeforeClass
@@ -74,9 +79,6 @@ public void setUp() {
         MockStringResourceHolder mock = repositoryResource.getComponent("stringResourceHolder");
         mock.setMessages(MESSAGES);

-        Map<String, String[]> params = new HashMap<String, String[]>();
-        params.put("param", new String[]{"200"});
-
         BasicStaticDataCache cache = repositoryResource.getComponent("validationManager.formDefinitionCache");
         cache.initialize();
         manager =  repositoryResource.getComponent("validationManager");
@@ -88,12 +90,9 @@ private void setUpEntityPropertyNameMode() {
         MockStringResourceHolder mock = repositoryResource.getComponent("stringResourceHolder");
         mock.setMessages(MESSAGES);

-        Map<String, String[]> params = new HashMap<String, String[]>();
-        params.put("param", new String[]{"10"});
-
         BasicStaticDataCache cache = repositoryResource.getComponent("validationManager2.formDefinitionCache");
         cache.initialize();
-        manager =  repositoryResource.getComponent("validationManager2");
+        manager = repositoryResource.getComponent("validationManager2");
         manager.initialize();
     }

@@ -107,9 +106,12 @@ public void testValidateAndConvertValidationSuccess() {

         Map<String, String[]> params = new HashMap<String, String[]>();

-        params.put("id", new String[]{"00000001"});
-        params.put("name", new String[]{"テストユーザ"});
-        params.put("age", new String[]{"30"});
+        params.put("id", new String[] {"00000001"});
+        params.put("name", new String[] {"テストユーザ"});
+        params.put("age", new String[] {"30"});
+        params.put("array", new String[] {"12345", null});
+        params.put("systemChar", new String[] {null});
+        params.put("num", new String[] {null});

         ValidationContext<User> result = manager.validateAndConvert("", User.class, params, null);
         User user = result.createObject();
@@ -117,6 +119,9 @@ public void testValidateAndConvertValidationSuccess() {
         assertEquals("00000001", user.getId());
         assertEquals("テストユーザ", user.getName());
         assertEquals(new BigDecimal(30l), user.getAge());
+        assertArrayEquals(new String[] {"12345", null}, user.getArray());
+        assertNull(user.getSystemChar());
+        assertNull(user.getNum());
     }

     /**
@@ -216,7 +221,8 @@ public void testValidateAndConvertValidationRequired() {
         assertFalse(result.isValid());

         ThreadContext.setLanguage(Locale.JAPANESE);
-        ValidationContextMatcher.ValidationContextWrapper contextWrapper = new ValidationContextMatcher.ValidationContextWrapper(result);
+        ValidationContextMatcher.ValidationContextWrapper contextWrapper = new ValidationContextMatcher.ValidationContextWrapper(
+                result);
         assertThat(contextWrapper, ValidationContextMatcher.containsMessage("MSG00011", "IDは必ず入力してください。", "id"));
         assertThat(contextWrapper, ValidationContextMatcher.containsMessage("MSG00011", "名前は必ず入力してください。", "name"));
         assertThat(contextWrapper, ValidationContextMatcher.containsMessage("MSG00011", "年齢は必ず入力してください。", "age"));
@@ -992,14 +998,24 @@ public void testPropertyMessageIdWasNotFoundUsePropertyNameAsMessageId() {
     }

     public static class User {
+
         private String id;
         private String name;
         private BigDecimal age;

+        private String[] array;
+
+        private String systemChar;
+
+        private Long num;
+
         public User(Map<String, Object> props) {
             id = (String) props.get("id");
             name = (String) props.get("name");
             age = (BigDecimal) props.get("age");
+            array = (String[]) props.get("array");
+            systemChar = (String) props.get("systemChar");
+            num = (Long) props.get("num");
         }

         public String getId() {
@@ -1032,9 +1048,39 @@ public BigDecimal getAge() {
         public void setAge(BigDecimal age) {
             this.age = age;
         }
+
+        public String[] getArray() {
+            return array;
+        }
+
+        @Length(max = 10)
+        @SystemChar
+        public void setArray(final String[] array) {
+            this.array = array;
+        }
+
+        public String getSystemChar() {
+            return systemChar;
+        }
+
+        @SystemChar
+        public void setSystemChar(final String systemChar) {
+            this.systemChar = systemChar;
+        }
+
+        public Long getNum() {
+            return num;
+        }
+
+        @Digits(integer = 15)
+        @NumberRange(max = 100000000000000D)
+        public void setNum(final Long num) {
+            this.num = num;
+        }
     }

     public static class StringArrayValueHolder {
+
         public StringArrayValueHolder(Map<String, Object> params) {
             codes = (String[]) params.get("codes");
         }
diff --git a/src/test/java/nablarch/core/validation/convertor/BigDecimalConvertorTest.java b/src/test/java/nablarch/core/validation/convertor/BigDecimalConvertorTest.java
index 7028924..876e74e 100644
--- a/src/test/java/nablarch/core/validation/convertor/BigDecimalConvertorTest.java
+++ b/src/test/java/nablarch/core/validation/convertor/BigDecimalConvertorTest.java
@@ -1,28 +1,33 @@
 package nablarch.core.validation.convertor;

+import static org.hamcrest.CoreMatchers.*;
+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertFalse;
+import static org.junit.Assert.assertNull;
+import static org.junit.Assert.assertThat;
+import static org.junit.Assert.assertTrue;
+import static org.junit.Assert.fail;
+
+import java.lang.annotation.Annotation;
+import java.math.BigDecimal;
+import java.util.HashMap;
+import java.util.Locale;
+import java.util.Map;
+
 import nablarch.core.ThreadContext;
 import nablarch.core.message.MockStringResourceHolder;
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.creator.ReflectionFormCreator;
 import nablarch.test.support.SystemRepositoryResource;
+
 import org.junit.Before;
 import org.junit.BeforeClass;
 import org.junit.ClassRule;
 import org.junit.Test;

-import java.lang.annotation.Annotation;
-import java.math.BigDecimal;
-import java.util.HashMap;
-import java.util.Locale;
-import java.util.Map;
-
-import static org.hamcrest.CoreMatchers.is;
-import static org.junit.Assert.*;
-
 public class BigDecimalConvertorTest {

-    private BigDecimalConvertor testee;
-    private static MockStringResourceHolder resource;
+    private BigDecimalConvertor testee = new BigDecimalConvertor();

     @ClassRule
     public static SystemRepositoryResource repo = new SystemRepositoryResource("nablarch/core/validation/convertor-test-base.xml");
@@ -38,18 +43,16 @@

     @BeforeClass
     public static void setUpClass() {
-        resource = repo.getComponentByType(MockStringResourceHolder.class);
-        resource.setMessages(MESSAGES);
+        final MockStringResourceHolder mockStringResourceHolder = new MockStringResourceHolder();
+        mockStringResourceHolder.setMessages(MESSAGES);
+        repo.addComponent("stringResourceHolder", mockStringResourceHolder);
     }

     @Before
     public void setUp() {
-        testee = new BigDecimalConvertor();
         testee.setMultiInputMessageId("MSG00001");
         testee.setInvalidDigitsFractionMessageId("MSG00002");
         testee.setInvalidDigitsIntegerMessageId("MSG00003");
-
-        // デフォルト動作としてnullは許可しない
         testee.setAllowNullValue(false);
     }

@@ -84,8 +87,7 @@ public void testIsConvertible() {
         params.put("param", new String[]{"10"});

         ValidationContext<TestTarget> context = new ValidationContext<TestTarget>(
-                "", TestTarget.class, new ReflectionFormCreator(),
-                params, "");
+                "", TestTarget.class, new ReflectionFormCreator(), params, "");

         assertTrue(testee.isConvertible(context, "param", "PROP0001", new String[]{"10"}, digits));
         assertTrue(testee.isConvertible(context, "param", "PROP0001", new String[]{"10.01"}, digits));
@@ -109,8 +111,8 @@ public void testIsConvertible() {
         assertTrue(testee.isConvertible(context, "param", "PROP0001", new Integer("-10"), digits));

         // nullを指定した場合
-        assertFalse(testee.isConvertible(context, "param", "PROP0001", null,
-                digits));
+        assertFalse(testee.isConvertible(context, "param", "PROP0001", null, digits));
+        assertFalse(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, digits));
     }

     @Test
@@ -272,8 +274,8 @@ public void testIsConvertibleAllowNullValue() {
                 new Integer("-10"), digits));

         // nullを指定した場合
-        assertTrue(testee.isConvertible(context, "param", "PROP0001", null,
-                digits));
+        assertTrue(testee.isConvertible(context, "param", "PROP0001", null, digits));
+        assertTrue(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, digits));
     }

     @Test
@@ -539,6 +541,16 @@ public void testConvert() {
         ValidationContext<TestTarget> context = new ValidationContext<TestTarget>(
                 "", TestTarget.class, new ReflectionFormCreator(),
                 params, "");
+
+        //**********************************************************************
+        // nullを指定
+        //**********************************************************************
+        assertNull(testee.convert(context, "param", null, null));
+        assertNull(testee.convert(context, "param", new String[] {null}, null));
+
+        //**********************************************************************
+        // String配列を指定
+        //**********************************************************************
         assertEquals(new BigDecimal("10"), testee.convert(context, "param", new String[]{"10"}, null));
         assertEquals(new BigDecimal("10000"), testee.convert(context, "param", new String[]{"10,000"}, null));
         assertEquals(new BigDecimal(".01"), testee.convert(context, "param", new String[]{".01"}, null));
diff --git a/src/test/java/nablarch/core/validation/convertor/BooleanConvertorTest.java b/src/test/java/nablarch/core/validation/convertor/BooleanConvertorTest.java
index d46adfc..f76a17a 100644
--- a/src/test/java/nablarch/core/validation/convertor/BooleanConvertorTest.java
+++ b/src/test/java/nablarch/core/validation/convertor/BooleanConvertorTest.java
@@ -1,28 +1,33 @@
 package nablarch.core.validation.convertor;

+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertFalse;
+import static org.junit.Assert.assertTrue;
+
+import java.util.HashMap;
+import java.util.Map;
+
 import nablarch.core.message.MockStringResourceHolder;
-import nablarch.core.repository.SystemRepository;
-import nablarch.core.repository.di.DiContainer;
-import nablarch.core.repository.di.config.xml.XmlComponentDefinitionLoader;
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.creator.ReflectionFormCreator;
+import nablarch.test.support.SystemRepositoryResource;
+
 import org.junit.BeforeClass;
+import org.junit.ClassRule;
 import org.junit.Test;

-import java.util.HashMap;
-import java.util.Map;
-
-import static org.junit.Assert.*;
-
 /**
  * {@link BooleanConvertor}のテストを行います。
  *
  * @author TIS
  */
 public class BooleanConvertorTest {
+
     private static BooleanConvertor testee;

-    private static MockStringResourceHolder resource;
+    @ClassRule
+    public static SystemRepositoryResource systemRepositoryResource = new SystemRepositoryResource(
+            "nablarch/core/validation/convertor-test-base.xml");

     private static final String[][] MESSAGES = {
             {"MSG00001", "ja", "{0}が正しくありません。", "en", "value of {0} is not valid."},
@@ -32,13 +37,11 @@

     @BeforeClass
     public static void setUpClass() {
-        XmlComponentDefinitionLoader loader = new XmlComponentDefinitionLoader(
-                "nablarch/core/validation/convertor-test-base.xml");
-        DiContainer container = new DiContainer(loader);
-        SystemRepository.load(container);
-
-        resource = container.getComponentByType(MockStringResourceHolder.class);
+        MockStringResourceHolder resource = new MockStringResourceHolder();
         resource.setMessages(MESSAGES);
+
+        systemRepositoryResource.addComponent("stringResourceHolder", resource);
+
         testee = new BooleanConvertor();
         testee.setConversionFailedMessageId("MSG00001");
     }
@@ -82,14 +85,14 @@ public void testIsConvertible() {

             // nullは不許可
             testee.setAllowNullValue(false);
-            assertFalse(testee.isConvertible(context, "param", "PROP0001", null,
-                    null));
+            assertFalse(testee.isConvertible(context, "param", "PROP0001", null, null));
+            assertFalse(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, null));

             // nullは許可(デフォルト動作)
             testee = new BooleanConvertor();
             testee.setConversionFailedMessageId("MSG00001");
-            assertTrue(testee.isConvertible(context, "param", "PROP0001", null,
-                    null));
+            assertTrue(testee.isConvertible(context, "param", "PROP0001", null, null));
+            assertTrue(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, null));

             // 空の文字列配列はNG
             assertFalse(testee.isConvertible(context, "param", "PROP0001",
@@ -124,6 +127,8 @@ public void testConvert() {
             assertEquals(Boolean.class, testee.getTargetClass());
             assertTrue((Boolean)testee.convert(context, "param", "true", null));
             assertFalse((Boolean)testee.convert(context, "param", "false", null));
+            assertTrue((Boolean)testee.convert(context, "param", true, null));
+            assertFalse((Boolean)testee.convert(context, "param", false, null));
             assertTrue((Boolean)testee.convert(context, "param", new String[]{"true"}, null));
             assertFalse((Boolean)testee.convert(context, "param", new String[]{"false"}, null));

@@ -131,6 +136,7 @@ public void testConvert() {
             assertFalse((Boolean)testee.convert(context, "param", "hoge", null));
             assertFalse((Boolean)testee.convert(context, "param", new String[]{"hoge"}, null));
             assertFalse((Boolean)testee.convert(context, "param", null, null));
+            assertFalse((Boolean) testee.convert(context, "param", new String[] {null}, null));
         }
     }
 }
diff --git a/src/test/java/nablarch/core/validation/convertor/IntegerConvertorTest.java b/src/test/java/nablarch/core/validation/convertor/IntegerConvertorTest.java
index d7fd807..448d01f 100644
--- a/src/test/java/nablarch/core/validation/convertor/IntegerConvertorTest.java
+++ b/src/test/java/nablarch/core/validation/convertor/IntegerConvertorTest.java
@@ -1,24 +1,30 @@
 package nablarch.core.validation.convertor;

+import static org.hamcrest.CoreMatchers.*;
+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertFalse;
+import static org.junit.Assert.assertNull;
+import static org.junit.Assert.assertThat;
+import static org.junit.Assert.assertTrue;
+import static org.junit.Assert.fail;
+
+import java.lang.annotation.Annotation;
+import java.math.BigDecimal;
+import java.util.HashMap;
+import java.util.Locale;
+import java.util.Map;
+
 import nablarch.core.ThreadContext;
 import nablarch.core.message.MockStringResourceHolder;
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.creator.ReflectionFormCreator;
 import nablarch.test.support.SystemRepositoryResource;
+
 import org.junit.Before;
 import org.junit.BeforeClass;
 import org.junit.ClassRule;
 import org.junit.Test;

-import java.lang.annotation.Annotation;
-import java.math.BigDecimal;
-import java.util.HashMap;
-import java.util.Locale;
-import java.util.Map;
-
-import static org.hamcrest.CoreMatchers.is;
-import static org.junit.Assert.*;
-
 public class IntegerConvertorTest {

     private static IntegerConvertor testee;
@@ -188,10 +194,15 @@ public void testIsConvertible() {
                 "", TestTarget.class, new ReflectionFormCreator(),
                 params, "");
         assertFalse(testee.isConvertible(context, "param", "PROP0001", null, digits));
+        assertFalse(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, digits));

-        assertEquals(1, context.getMessages().size());
+        assertEquals(2, context.getMessages()
+                               .size());
         ThreadContext.setLanguage(Locale.ENGLISH);
         assertEquals("property1", context.getMessages().get(0).formatMessage());
+        assertEquals("property1", context.getMessages()
+                                         .get(1)
+                                         .formatMessage());
     }

     @Test
@@ -379,7 +390,8 @@ public void testIsConvertibleAllowNullValue() {
         //**********************************************************************
         assertTrue(testee.isConvertible(context, "param", "PROP0001",
                 null, digits));
-
+        assertTrue(testee.isConvertible(context, "param", "PROP0001",
+                new String[] {null}, digits));
     }

     @Test
@@ -419,7 +431,7 @@ public void testisConvert() {
      * nullを許可する場合のテスト。
      */
     @Test
-    public void testisConvertAllowNullValue() {
+    public void testConvertAllowNullValue() {

         // nullを許可する。(デフォルト動作)
         testee = new IntegerConvertor();
@@ -434,17 +446,15 @@ public void testisConvertAllowNullValue() {
                 "", TestTarget.class, new ReflectionFormCreator(),
                 params, "");

-        Integer i = (Integer) testee.convert(context, "param", new String[]{"10"}, digits);
-        assertEquals(Integer.valueOf(10), i);
+        assertEquals(10, testee.convert(context, "param", new String[] {"10"}, digits));

-        Integer i2 = (Integer) testee.convert(context, "param", new Integer(10), digits);
-        assertEquals(Integer.valueOf(10), i2);
+        assertEquals(10, testee.convert(context, "param", 10, digits));

-        Integer i3 = (Integer) testee.convert(context, "param", new Integer(Integer.MAX_VALUE), digits);
-        assertEquals(Integer.valueOf(Integer.MAX_VALUE), i3);
+        assertEquals(Integer.MAX_VALUE, testee.convert(context, "param", Integer.MAX_VALUE, digits));

-        Integer i4 = (Integer) testee.convert(context, "param", null, digits);
-        assertNull(i4);
+        assertNull(testee.convert(context, "param", null, digits));
+        assertNull(testee.convert(context, "param", new String[] {null}, digits));
+

     }

@@ -577,6 +587,8 @@ public void testConvert() {
         assertEquals(10, testee.convert(context, "param", new String[]{"10"}, digits));
         assertEquals(10000, testee.convert(context, "param", new String[]{"10,000"}, digits));
         assertNull(testee.convert(context, "param", new String[]{""}, digits));
+        assertNull(testee.convert(context, "param", null, digits));
+        assertNull(testee.convert(context, "param", new String[] {null}, digits));
     }

     @Test
diff --git a/src/test/java/nablarch/core/validation/convertor/LongConvertorTest.java b/src/test/java/nablarch/core/validation/convertor/LongConvertorTest.java
index 49f4e2c..5987fc1 100644
--- a/src/test/java/nablarch/core/validation/convertor/LongConvertorTest.java
+++ b/src/test/java/nablarch/core/validation/convertor/LongConvertorTest.java
@@ -1,24 +1,30 @@
 package nablarch.core.validation.convertor;

+import static org.hamcrest.CoreMatchers.*;
+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertFalse;
+import static org.junit.Assert.assertNull;
+import static org.junit.Assert.assertThat;
+import static org.junit.Assert.assertTrue;
+import static org.junit.Assert.fail;
+
+import java.lang.annotation.Annotation;
+import java.math.BigDecimal;
+import java.util.HashMap;
+import java.util.Locale;
+import java.util.Map;
+
 import nablarch.core.ThreadContext;
 import nablarch.core.message.MockStringResourceHolder;
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.creator.ReflectionFormCreator;
 import nablarch.test.support.SystemRepositoryResource;
+
 import org.junit.Before;
 import org.junit.BeforeClass;
 import org.junit.ClassRule;
 import org.junit.Test;

-import java.lang.annotation.Annotation;
-import java.math.BigDecimal;
-import java.util.HashMap;
-import java.util.Locale;
-import java.util.Map;
-
-import static org.hamcrest.CoreMatchers.is;
-import static org.junit.Assert.*;
-
 public class LongConvertorTest {

     private static LongConvertor testee;
@@ -168,13 +174,18 @@ public void testIsConvertible() {
                 "", TestTarget.class, new ReflectionFormCreator(),
                 params, "");

-        assertFalse(testee.isConvertible(context, "param", "PROP0001",
-                null, digits));
+        assertFalse(testee.isConvertible(context, "param", "PROP0001", null, digits));
+        assertFalse(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, digits));

-        assertEquals(1, context.getMessages().size());
+        assertEquals(2, context.getMessages()
+                               .size());
         ThreadContext.setLanguage(Locale.ENGLISH);
-        assertEquals("property1",
-                context.getMessages().get(0).formatMessage());
+        assertEquals("property1", context.getMessages()
+                                         .get(0)
+                                         .formatMessage());
+        assertEquals("property1", context.getMessages()
+                                         .get(1)
+                                         .formatMessage());
     }

     @Test
@@ -358,8 +369,8 @@ public void testIsConvertibleAllowNullValue() {
                 "", TestTarget.class, new ReflectionFormCreator(),
                 params, "");

-        assertTrue(testee.isConvertible(context, "param", "PROP0001",
-                null, digits));
+        assertTrue(testee.isConvertible(context, "param", "PROP0001", null, digits));
+        assertTrue(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, digits));
     }

     @Test
@@ -481,6 +492,9 @@ public void testConvert() {
         assertEquals(1L, testee.convert(context, "param", 1L, digits));
         assertEquals(1L, testee.convert(context, "param", new BigDecimal("1"), digits));
         assertEquals(-12345L, testee.convert(context, "param", new BigDecimal("-12345"), digits));
+
+        assertNull(testee.convert(context, "param", null, digits));
+        assertNull(testee.convert(context, "param", new String[] {null}, digits));
     }

     @Test
@@ -544,6 +558,7 @@ public void testConvertAllowNullValue() {
         assertEquals(1L, testee.convert(context, "param", new BigDecimal("1"), digits));
         assertEquals(-12345L, testee.convert(context, "param", new BigDecimal("-12345"), digits));
         assertNull(testee.convert(context, "param", null, digits));
+        assertNull(testee.convert(context, "param", new String[] {null}, digits));
     }


diff --git a/src/test/java/nablarch/core/validation/convertor/StringArrayConvertorTest.java b/src/test/java/nablarch/core/validation/convertor/StringArrayConvertorTest.java
index 7c10c5e..52fca02 100644
--- a/src/test/java/nablarch/core/validation/convertor/StringArrayConvertorTest.java
+++ b/src/test/java/nablarch/core/validation/convertor/StringArrayConvertorTest.java
@@ -1,87 +1,88 @@
 package nablarch.core.validation.convertor;

-import nablarch.core.message.MockStringResourceHolder;
-import nablarch.core.repository.SystemRepository;
-import nablarch.core.repository.di.DiContainer;
-import nablarch.core.repository.di.config.xml.XmlComponentDefinitionLoader;
+import static org.hamcrest.CoreMatchers.*;
+import static org.junit.Assert.assertThat;
+
+import java.math.BigDecimal;
+import java.util.Arrays;
+import java.util.Collection;
+import java.util.Collections;
+
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.creator.ReflectionFormCreator;
-import org.junit.BeforeClass;
+
+import org.junit.Rule;
 import org.junit.Test;
+import org.junit.experimental.runners.Enclosed;
+import org.junit.rules.ExpectedException;
+import org.junit.runner.RunWith;
+import org.junit.runners.Parameterized;
+import org.junit.runners.Parameterized.Parameters;

-import java.util.HashMap;
-import java.util.Map;
+@RunWith(Enclosed.class)
+public class StringArrayConvertorTest {

-import static org.junit.Assert.assertTrue;
-import static org.junit.Assert.fail;
+    @RunWith(Parameterized.class)
+    public static class 変換可能の場合のテスト {

-public class StringArrayConvertorTest {
-    private static StringArrayConvertor testee;
+        private final StringArrayConvertor sut = new StringArrayConvertor();

-    private static MockStringResourceHolder resource;
+        private final String[] params;

-    private static final String[][] MESSAGES = {
-            {"MSG00001", "ja", "{0}が正しくありません。", "en", "value of {0} is not valid."},
-            {"PROP0001", "ja", "プロパティ1", "en", "property1"},};
+        @Parameters
+        public static Collection<Object[]> data() {
+            return Arrays.asList(
+                    new Object[] {new String[] {"1", "2"}},
+                    new Object[] {new String[] {"1", "2", "3"}},
+                    new Object[] {new String[] {null}},
+                    new Object[] {null});
+        }

+        public 変換可能の場合のテスト(final String[] params) {
+            this.params = params;
+        }

+        @Test
+        public void test() {
+            ValidationContext<TestTarget> context = new ValidationContext<TestTarget>(
+                    "", TestTarget.class, new ReflectionFormCreator(), Collections.<String, Object>emptyMap(), "");

-    @BeforeClass
-    public static void setUpClass() {
-        XmlComponentDefinitionLoader loader = new XmlComponentDefinitionLoader(
-                "nablarch/core/validation/convertor-test-base.xml");
-        DiContainer container = new DiContainer(loader);
-        SystemRepository.load(container);

-        resource = container.getComponentByType(MockStringResourceHolder.class);
-        resource.setMessages(MESSAGES);
-        testee = new StringArrayConvertor();
+            assertThat(sut.isConvertible(context, "param", "param", params, null), is(true));
+            assertThat((String[]) sut.convert(context, "param", params, null), is(params));
+        }
     }

+    @RunWith(Parameterized.class)
+    public static class 変換不可能な場合のテスト {

-    @Test
-    public void testIsConvertible() {
+        private final StringArrayConvertor sut = new StringArrayConvertor();

-        Map<String, String[]> params = new HashMap<String, String[]>();
+        private final Object value;

-        params.put("param", new String[]{"10"});
+        @Rule
+        public ExpectedException expectedException = ExpectedException.none();

-        {
-            ValidationContext<TestTarget> context = new ValidationContext<TestTarget>(
-                    "", TestTarget.class,
-                    new ReflectionFormCreator(),
-                    params, "");
-
-
-            //　配列長違いは全てOK
-            assertTrue(testee.isConvertible(context, "param", "PROP0001",
-                    new String[]{"10", "20", "30"}, null));
-            assertTrue(testee.isConvertible(context, "param", "PROP0001",
-                    new String[]{"10"}, null));
-            assertTrue(testee.isConvertible(context, "param", "PROP0001",
-                    new String[]{}, null));
-
-            // nullは許可
-            assertTrue(testee.isConvertible(context, "param", "PROP0001", null,
-                    null));
+        @Parameters
+        public static Collection<Object[]> data() {
+            return Arrays.asList(
+                    new Object[] {new Object[] {"1", "2"}},
+                    new Object[] {new Integer[] {1, 2, 3}},
+                    new Object[] {"string"},
+                    new Object[] {BigDecimal.ONE});
         }

+        public 変換不可能な場合のテスト(final Object value) {
+            this.value = value;
+        }

-        {
-        	// 引数の型が String[]以外の場合
+        @Test
+        public void test() {
             ValidationContext<TestTarget> context = new ValidationContext<TestTarget>(
-                    "", TestTarget.class,
-                    new ReflectionFormCreator(),
-                    params, "");
-        	// ここに Integer が設定されるのは、(今のところ)プログラムバグのみ。
-            try {
-            	testee.isConvertible(context, "param", "PROP0001", Integer.valueOf(1),
-                    null);
-            	fail("例外が発生するはず。");
-            } catch (IllegalArgumentException e) {
-
-            }
+                    "", TestTarget.class, new ReflectionFormCreator(), Collections.<String, Object>emptyMap(), "");
+
+            expectedException.expect(IllegalArgumentException.class);
+            sut.isConvertible(context, "prop", "prop", value, null);
         }
     }
-
 }
diff --git a/src/test/java/nablarch/core/validation/convertor/StringConvertorTest.java b/src/test/java/nablarch/core/validation/convertor/StringConvertorTest.java
index 4a733d0..d30ed41 100644
--- a/src/test/java/nablarch/core/validation/convertor/StringConvertorTest.java
+++ b/src/test/java/nablarch/core/validation/convertor/StringConvertorTest.java
@@ -82,7 +82,6 @@ public void testIsConvertible() {
         params.put("param", new String[]{"10"});

         正常に変換されるケース: {
-            System.out.println("params = " + params);
             ValidationContext<TestTarget> context = new ValidationContext<TestTarget>(
                     "", TestTarget.class,
                     new ReflectionFormCreator(),
@@ -133,13 +132,15 @@ public void testIsConvertible() {
                     "", TestTarget.class,
                     new ReflectionFormCreator(),
                     params, "");
-            assertFalse(testee.isConvertible(context, "param", "PROP0001", null,
-                    null));
+            assertFalse(testee.isConvertible(context, "param", "PROP0001", null, null));
+            assertFalse(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, null));

-            assertEquals(1, context.getMessages().size());
+            assertEquals(2, context.getMessages().size());
             ThreadContext.setLanguage(Locale.ENGLISH);
             assertEquals("value of PROP0001 is not valid.",
                     context.getMessages().get(0).formatMessage());
+            assertEquals("value of PROP0001 is not valid.",
+                    context.getMessages().get(1).formatMessage());
         }

         文字列を指定した場合: {
@@ -211,7 +212,6 @@ public void testIsConvertibleAllowNullValue() {
         params.put("param", new String[]{"10"});

         正常に変換されるケース: {
-            System.out.println("params = " + params);
             ValidationContext<TestTarget> context = new ValidationContext<TestTarget>(
                     "", TestTarget.class,
                     new ReflectionFormCreator(),
@@ -264,8 +264,8 @@ public void testIsConvertibleAllowNullValue() {
                     "", TestTarget.class,
                     new ReflectionFormCreator(),
                     params, "");
-            assertTrue(testee.isConvertible(context, "param", "PROP0001", null,
-                    null));
+            assertTrue(testee.isConvertible(context, "param", "PROP0001", null, null));
+            assertTrue(testee.isConvertible(context, "param", "PROP0001", new String[] {null}, null));

         }

@@ -385,6 +385,7 @@ public void testConvertAllowNullValue() {
                 null));
         assertEquals("StringはOK", "文字列", testee.convert(context, "param", "文字列", null));
         assertNull("nullはOK", testee.convert(context, "param", null, null));
+        assertNull("nullのみの要素1つの配列もOK", testee.convert(context, "param", new String[] {null}, null));
     }
     @Test
     public void testTargetClass() {
diff --git a/src/test/java/nablarch/core/validation/validator/LengthValidatorTest.java b/src/test/java/nablarch/core/validation/validator/LengthValidatorTest.java
index f1f6099..17f29cf 100644
--- a/src/test/java/nablarch/core/validation/validator/LengthValidatorTest.java
+++ b/src/test/java/nablarch/core/validation/validator/LengthValidatorTest.java
@@ -1,5 +1,17 @@
 package nablarch.core.validation.validator;

+import static org.hamcrest.CoreMatchers.*;
+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertFalse;
+import static org.junit.Assert.assertThat;
+import static org.junit.Assert.assertTrue;
+import static org.junit.Assert.fail;
+
+import java.lang.annotation.Annotation;
+import java.util.HashMap;
+import java.util.Locale;
+import java.util.Map;
+
 import nablarch.core.ThreadContext;
 import nablarch.core.message.MockStringResourceHolder;
 import nablarch.core.repository.SystemRepository;
@@ -8,18 +20,10 @@
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.convertor.TestTarget;
 import nablarch.core.validation.creator.ReflectionFormCreator;
+
 import org.junit.Before;
 import org.junit.Test;

-import java.lang.annotation.Annotation;
-import java.util.HashMap;
-import java.util.Locale;
-import java.util.Map;
-
-import static org.hamcrest.CoreMatchers.instanceOf;
-import static org.hamcrest.CoreMatchers.is;
-import static org.junit.Assert.*;
-

 public class LengthValidatorTest {

@@ -82,7 +86,8 @@ public void testValidateSuccess() {

         assertTrue(testee.validate(context, "param", "PROP0001", length, "12345"));
         assertTrue(testee.validate(context, "param", "PROP0001", length, "1234567"));
-        assertTrue(testee.validate(context, "param", "PROP0001", length, "1234567890"));
+        assertTrue(testee.validate(context, "param", "PROP0001", length, "1234567890"));
+        assertTrue("nullはOK", testee.validate(context, "param", "PROP0001", length, null));
     }
     @Test
     public void testValidateLonger() {
@@ -159,7 +164,7 @@ public int max() {
     @Test
     public void testValidateMulti() {

-        assertTrue(testee.validate(context, "param", "PROP0001", length, new String[] {"12345", "0123456789"}));
+        assertTrue(testee.validate(context, "param", "PROP0001", length, new String[] {"12345", "0123456789", null}));
         assertFalse(testee.validate(context, "param", "PROP0001", length, new String[] {"12345", "01234567890", "1234"}));

         assertEquals(1, context.getMessages().size());
diff --git a/src/test/java/nablarch/core/validation/validator/NumberRangeValidatorTest.java b/src/test/java/nablarch/core/validation/validator/NumberRangeValidatorTest.java
index a84ca4b..a8dcd82 100644
--- a/src/test/java/nablarch/core/validation/validator/NumberRangeValidatorTest.java
+++ b/src/test/java/nablarch/core/validation/validator/NumberRangeValidatorTest.java
@@ -1,5 +1,15 @@
 package nablarch.core.validation.validator;

+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertFalse;
+import static org.junit.Assert.assertTrue;
+
+import java.lang.annotation.Annotation;
+import java.math.BigDecimal;
+import java.util.HashMap;
+import java.util.Locale;
+import java.util.Map;
+
 import nablarch.core.ThreadContext;
 import nablarch.core.message.MockStringResourceHolder;
 import nablarch.core.repository.SystemRepository;
@@ -8,17 +18,10 @@
 import nablarch.core.validation.ValidationContext;
 import nablarch.core.validation.convertor.TestTarget;
 import nablarch.core.validation.creator.ReflectionFormCreator;
+
 import org.junit.Before;
 import org.junit.Test;

-import java.lang.annotation.Annotation;
-import java.math.BigDecimal;
-import java.util.HashMap;
-import java.util.Locale;
-import java.util.Map;
-
-import static org.junit.Assert.*;
-

 public class NumberRangeValidatorTest {

@@ -88,6 +91,7 @@ public void testValidateSuccess() {
         assertTrue(testee.validate(context, "param", "PROP0001", range, new BigDecimal(11)));
         assertTrue(testee.validate(context, "param", "PROP0001", range, 10.1));
         assertTrue(testee.validate(context, "param", "PROP0001", range, 10.1f));
+        assertTrue(testee.validate(context, "param", "PROP0001", range, null));

     }

diff --git a/src/test/resources/nablarch/core/validation/validation-manager.xml b/src/test/resources/nablarch/core/validation/validation-manager.xml
index 8fb61be..500d9ad 100644
--- a/src/test/resources/nablarch/core/validation/validation-manager.xml
+++ b/src/test/resources/nablarch/core/validation/validation-manager.xml
@@ -40,6 +40,14 @@
                     <property name="maxAndMinMessageId" value="MSG00022"/>
                     <property name="fixLengthMessageId" value="MSG00023"/>
                 </component>
+                <component class="nablarch.core.validation.validator.unicode.SystemCharValidator">
+                  <property name="defaultCharsetDef">
+                    <component class="nablarch.core.validation.validator.unicode.LiteralCharsetDef">
+                      <property name="allowedCharacters" value="1234567890" />
+                      <property name="messageId" value="systemchar.message" />
+                    </component>
+                  </property>
+                </component>
             </list>
         </property>
         <property name="formDefinitionCache">
@@ -90,6 +98,14 @@
                     <property name="maxAndMinMessageId" value="MSG00022"/>
                     <property name="fixLengthMessageId" value="MSG00023"/>
                 </component>
+                <component class="nablarch.core.validation.validator.unicode.SystemCharValidator">
+                  <property name="defaultCharsetDef">
+                    <component class="nablarch.core.validation.validator.unicode.LiteralCharsetDef">
+                      <property name="allowedCharacters" value="1234567890" />
+                      <property name="messageId" value="systemchar.message" />
+                    </component>
+                  </property>
+                </component>
             </list>
         </property>
         <property name="formDefinitionCache">
```
